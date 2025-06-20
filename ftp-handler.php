<?php
header('Content-Type: application/json');

// Error handling
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', 'ftp_errors.log');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Invalid request method');
    }

    // Validate required parameters
    $required = ['host', 'username', 'password', 'action'];
    foreach ($required as $param) {
        if (!isset($_POST[$param])) {
            throw new Exception("Missing required parameter: $param");
        }
    }

    $host = $_POST['host'];
    $username = $_POST['username'];
    $password = $_POST['password'];
    $path = $_POST['path'] ?? '/Sandbox_config.sbc';
    $type = $_POST['type'] ?? 'ftp';
    $port = $_POST['port'] ?? ($type === 'ftps' ? 990 : 21);

    // Debug logging
    error_log("Attempting connection to: $host:$port ($type)");

    if ($type === 'ftps') {
        // Secure FTP connection
        $conn = ftp_ssl_connect($host, $port, 30);
    } else {
        // Standard FTP connection
        $conn = ftp_connect($host, $port, 30);
    }

    if (!$conn) {
        throw new Exception("Could not connect to FTP server at $host:$port");
    }

    // Login
    if (!@ftp_login($conn, $username, $password)) {
        throw new Exception('FTP authentication failed');
    }

    // Enable passive mode
    ftp_pasv($conn, true);

    // Handle different actions
    switch ($_POST['action']) {
        case 'connect':
            // Try to read the config file
            $tempFile = tempnam(sys_get_temp_dir(), 'config');
            if (!@ftp_get($conn, $tempFile, $path, FTP_BINARY)) {
                throw new Exception("Failed to download config file from: $path");
            }

            $content = file_get_contents($tempFile);
            unlink($tempFile);

            echo json_encode([
                'success' => true,
                'data' => $content
            ]);
            break;

        case 'update':
            // Handle file updates
            if (!isset($_POST['content'])) {
                throw new Exception('No content provided for update');
            }

            $tempFile = tempnam(sys_get_temp_dir(), 'config');
            file_put_contents($tempFile, $_POST['content']);

            if (!@ftp_put($conn, $path, $tempFile, FTP_BINARY)) {
                throw new Exception('Failed to upload file');
            }

            unlink($tempFile);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action specified');
    }

    ftp_close($conn);

} catch (Exception $e) {
    error_log('FTP Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>