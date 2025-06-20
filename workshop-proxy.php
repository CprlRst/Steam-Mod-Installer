workshop-proxy.php


<?php
session_start();
header('Content-Type: application/json');

error_reporting(E_ALL);
ini_set('display_errors', 1);

// Debug session ID
error_log('Session ID in workshop-proxy.php: ' . session_id());

try {
    $baseUrl = 'https://steamcommunity.com/workshop/browse/?appid=244850';
    
    // Add any additional parameters from the request
    if (isset($_POST['params'])) {
        $baseUrl .= '&' . $_POST['params'];
    }
    
    $modsJson = file_get_contents($baseUrl);
    if ($modsJson === FALSE) {
        throw new Exception('Error fetching mods.');
    }

    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML($modsJson);
    libxml_clear_errors();

    $xpath = new DOMXPath($dom);
    
    $modsData = ['mods' => []];
    $items = $xpath->query('//div[contains(@class, "workshopItem")]');

    foreach ($items as $item) {
        $modsData['mods'][] = [
            'image' => $xpath->evaluate('string(.//img[@class="workshopItemPreviewImage"]/@src)', $item),
            'title' => $xpath->evaluate('string(.//div[@class="workshopItemTitle"])', $item),
            'author' => $xpath->evaluate('string(.//a[@class="workshop_author_link"])', $item),
            'rating' => $xpath->evaluate('string(.//img[@class="fileRating"]/@src)', $item),
            'link' => $xpath->evaluate('string(.//a[@class="ugc"]/@href)', $item)
        ];
    }

    echo json_encode($modsData);

} catch (Exception $e) {
    error_log($e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>