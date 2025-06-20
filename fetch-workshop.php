<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Base URL for Space Engineers Workshop
$baseUrl = 'https://steamcommunity.com/workshop/browse/?appid=244850';

// Get search parameters
$searchText = $_GET['searchText'] ?? '';
$sort = $_GET['sort'] ?? 'totaluniquesubscribers';
$type = $_GET['type'] ?? '';
$categories = isset($_GET['categories']) ? json_decode($_GET['categories']) : [];

// Build URL with parameters
$url = $baseUrl;

// Add sorting
$url .= "&browsesort=" . urlencode($sort);

// Add search text
if (!empty($searchText)) {
    $url .= "&searchtext=" . urlencode($searchText);
}

// Add type filter
if (!empty($type)) {
    $url .= "&requiredtags[]=" . urlencode($type);
}

// Add categories
if (!empty($categories)) {
    foreach ($categories as $category) {
        $url .= "&requiredtags[]=" . urlencode($category);
    }
}

// Add additional parameters
$url .= "&actualsort=" . urlencode($sort);
$url .= "&p=1"; // First page
$url .= "&days=-1"; // All time

// Fetch workshop page
$html = @file_get_contents($url);
if ($html === FALSE) {
    die(json_encode(['error' => 'Error fetching workshop content']));
}

$dom = new DOMDocument();
libxml_use_internal_errors(true);
$dom->loadHTML($html);
libxml_clear_errors();

$xpath = new DOMXPath($dom);
$items = $xpath->query('//div[contains(@class, "workshopItem")]');
$modsData = ['mods' => []];

foreach ($items as $item) {
    $imageNode = $xpath->query('.//img[contains(@class, "workshopItemPreviewImage")]', $item)->item(0);
    
    // Get next sibling script tag
    $nextNode = $item->nextSibling;
    while ($nextNode && $nextNode->nodeName !== 'script') {
        $nextNode = $nextNode->nextSibling;
    }
    
    $title = 'Unknown Title';
    $description = 'No description available';
    $modId = '';

    if ($nextNode && $nextNode->nodeName === 'script') {
        $scriptText = $nextNode->textContent;
        if (preg_match('/SharedFileBindMouseHover\([^,]*,\s*false,\s*({.*?})\s*\)/', $scriptText, $matches)) {
            $data = json_decode($matches[1], true);
            if ($data) {
                $title = $data['title'];
                $description = html_entity_decode($data['description']);
                $modId = $data['id']; // Extract mod ID from JSON data
            }
        }
    }
    
    $modsData['mods'][] = [
        'image' => $imageNode ? $imageNode->getAttribute('src') : '',
        'title' => $title,
        'author' => $xpath->evaluate('string(.//a[@class="workshop_author_link"])', $item),
        'rating' => $xpath->evaluate('string(.//img[@class="fileRating"]/@src)', $item),
        'link' => "https://steamcommunity.com/sharedfiles/filedetails/?id={$modId}",
        'id' => $modId,
        'description' => $description
    ];
}

echo json_encode($modsData);
?>