<?php

declare(strict_types=1);

const MAX_REQUEST_BYTES = 1024;
const MAX_SCORE = 999999;
const MAX_WORLD_REACHED = 99;
const MAX_NAME_LENGTH = 12;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 12;
const ALLOWED_POST_FIELDS = ['name', 'score', 'victory', 'worldReached'];
const ALLOWED_NAME_PATTERN = '/^[A-Z0-9]{1,12}$/';

$storageDir = dirname(__DIR__, 2) . '/storage';
$storageFile = $storageDir . '/highscores.json';
$rateLimitFile = $storageDir . '/highscore-rate-limit.json';
$securityLogFile = $storageDir . '/highscore-security.log';
$limit = max(1, min(50, (int) ($_GET['limit'] ?? 10)));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

header('Content-Type: application/json; charset=utf-8');
apply_cors_headers($origin);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!is_dir($storageDir) && !mkdir($storageDir, 0775, true) && !is_dir($storageDir)) {
    respond(['error' => 'Unable to initialize high score storage.'], 500);
}

if (!file_exists($storageFile)) {
    file_put_contents($storageFile, json_encode([], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

if (!file_exists($rateLimitFile)) {
    file_put_contents($rateLimitFile, json_encode(new stdClass(), JSON_PRETTY_PRINT), LOCK_EX);
}

$clientIp = get_client_ip();
if (!check_rate_limit($rateLimitFile, $clientIp, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_REQUESTS)) {
    log_security_event($securityLogFile, 'rate_limit_exceeded', ['ip' => $clientIp]);
    respond(['error' => 'Too many requests. Please slow down.'], 429);
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        $scores = load_scores($storageFile);
        respond(['scores' => array_slice($scores, 0, $limit)]);
        break;

    case 'POST':
        $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength > MAX_REQUEST_BYTES) {
            log_security_event($securityLogFile, 'payload_too_large', ['ip' => $clientIp, 'bytes' => $contentLength]);
            respond(['error' => 'Payload too large.'], 413);
        }

        $rawPayload = file_get_contents('php://input') ?: '';
        if (strlen($rawPayload) > MAX_REQUEST_BYTES) {
            log_security_event($securityLogFile, 'payload_too_large_runtime', ['ip' => $clientIp, 'bytes' => strlen($rawPayload)]);
            respond(['error' => 'Payload too large.'], 413);
        }

        $payload = json_decode($rawPayload, true);
        if (!is_array($payload)) {
            log_security_event($securityLogFile, 'invalid_json', ['ip' => $clientIp]);
            respond(['error' => 'Invalid JSON payload.'], 400);
        }

        $unexpectedFields = array_diff(array_keys($payload), ALLOWED_POST_FIELDS);
        if ($unexpectedFields !== []) {
            log_security_event($securityLogFile, 'unexpected_fields', ['ip' => $clientIp, 'fields' => array_values($unexpectedFields)]);
            respond(['error' => 'Unexpected fields in payload.'], 422);
        }

        $name = strtoupper(trim((string) ($payload['name'] ?? '')));
        $score = filter_var($payload['score'] ?? null, FILTER_VALIDATE_INT);
        $victory = filter_var($payload['victory'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $worldReached = filter_var($payload['worldReached'] ?? null, FILTER_VALIDATE_INT);

        if ($name === '') {
            respond(['error' => 'Name is required.'], 422);
        }

        if (strlen($name) > MAX_NAME_LENGTH) {
            log_security_event($securityLogFile, 'name_too_long', ['ip' => $clientIp, 'name' => $name]);
            respond(['error' => 'Name is too long.'], 422);
        }

        if (!preg_match(ALLOWED_NAME_PATTERN, $name)) {
            log_security_event($securityLogFile, 'invalid_name', ['ip' => $clientIp, 'name' => $name]);
            respond(['error' => 'Name must contain only A-Z and 0-9.'], 422);
        }

        if ($score === false || $score < 0 || $score > MAX_SCORE) {
            log_security_event($securityLogFile, 'invalid_score', ['ip' => $clientIp, 'score' => $payload['score'] ?? null]);
            respond(['error' => 'Invalid score.'], 422);
        }

        if ($victory === null) {
            log_security_event($securityLogFile, 'invalid_victory', ['ip' => $clientIp, 'victory' => $payload['victory'] ?? null]);
            respond(['error' => 'Invalid victory flag.'], 422);
        }

        if ($worldReached === false || $worldReached < 1 || $worldReached > MAX_WORLD_REACHED) {
            log_security_event($securityLogFile, 'invalid_world', ['ip' => $clientIp, 'worldReached' => $payload['worldReached'] ?? null]);
            respond(['error' => 'Invalid world reached.'], 422);
        }

        $entry = [
            'name' => $name,
            'score' => $score,
            'victory' => $victory,
            'worldReached' => $worldReached,
            'createdAt' => gmdate(DATE_ATOM),
        ];

        $scores = load_scores($storageFile);
        $scores[] = $entry;
        $scores = sort_scores($scores);
        $scores = array_slice($scores, 0, 100);

        if (file_put_contents($storageFile, json_encode($scores, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) {
            respond(['error' => 'Unable to persist high score.'], 500);
        }

        $insertedRank = null;
        foreach ($scores as $index => $scoreEntry) {
            if ($scoreEntry === $entry) {
                $insertedRank = $index + 1;
                break;
            }
        }

        respond([
            'scores' => array_slice($scores, 0, $limit),
            'insertedRank' => $insertedRank,
        ], 201);
        break;

    default:
        respond(['error' => 'Method not allowed.'], 405);
}

function apply_cors_headers(string $origin): void
{
    $allowedOrigins = array_filter([
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        getenv('HIGH_SCORE_ALLOWED_ORIGIN') ?: null,
    ]);

    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

function get_client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function check_rate_limit(string $rateLimitFile, string $clientIp, int $windowSeconds, int $maxRequests): bool
{
    $now = time();
    $state = json_decode(file_get_contents($rateLimitFile) ?: '{}', true);
    if (!is_array($state)) {
        $state = [];
    }

    $entries = $state[$clientIp] ?? [];
    if (!is_array($entries)) {
        $entries = [];
    }

    $entries = array_values(array_filter($entries, static fn ($timestamp): bool => is_int($timestamp) && $timestamp >= ($now - $windowSeconds)));
    if (count($entries) >= $maxRequests) {
        return false;
    }

    $entries[] = $now;
    $state[$clientIp] = $entries;

    foreach ($state as $ip => $timestamps) {
        if (!is_array($timestamps) || $timestamps === []) {
            unset($state[$ip]);
        }
    }

    file_put_contents($rateLimitFile, json_encode($state, JSON_PRETTY_PRINT), LOCK_EX);

    return true;
}

function load_scores(string $storageFile): array
{
    $raw = file_get_contents($storageFile);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }

    return sort_scores(array_values(array_filter($decoded, 'is_array')));
}

function sort_scores(array $scores): array
{
    usort($scores, static function (array $a, array $b): int {
        $scoreCompare = ($b['score'] ?? 0) <=> ($a['score'] ?? 0);
        if ($scoreCompare !== 0) {
            return $scoreCompare;
        }

        $worldCompare = ($b['worldReached'] ?? 0) <=> ($a['worldReached'] ?? 0);
        if ($worldCompare !== 0) {
            return $worldCompare;
        }

        return strcmp((string) ($a['createdAt'] ?? ''), (string) ($b['createdAt'] ?? ''));
    });

    return $scores;
}

function log_security_event(string $securityLogFile, string $event, array $context): void
{
    $line = sprintf(
        "[%s] %s %s\n",
        gmdate(DATE_ATOM),
        $event,
        json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );

    file_put_contents($securityLogFile, $line, FILE_APPEND | LOCK_EX);
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}
