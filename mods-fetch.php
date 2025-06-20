mods-fetch.php


<?php
session_start();
header('Content-Type: application/json');

error_reporting(E_ALL);
ini_set('display_errors', 1);

$sort = $_GET['sort'] ?? 'trend';
$tag = $_GET['tag'] ?? 'none';
$categories = isset($_GET['categories']) ? explode(',', $_GET['categories']) : [];
$searchText = $_GET['searchtext'] ?? '';

// Build Steam Workshop URL
$url = "https://steamcommunity.com/workshop/browse/?appid=244850&browsesort={$sort}";
if ($searchText) {
    $url .= "&searchtext=" . urlencode($searchText);
}
if ($tag !== 'none') {
    $url .= "&requiredtags[]=" . urlencode($tag);
}
foreach ($categories as $category) {
    $url .= "&requiredtags[]=" . urlencode($category);
}

$modsJson = file_get_contents($url);
if ($modsJson === FALSE) {
    die(json_encode(['error' => 'Error fetching mods.']));
}

$dom = new DOMDocument();
libxml_use_internal_errors(true);
$dom->loadHTML($modsJson);
libxml_clear_errors();

$xpath = new DOMXPath($dom);
$items = $xpath->query('//div[contains(@class, "workshopItem")]');
$modsData = [];

foreach ($items as $item) {
    $modsData[] = [
        'title' => $xpath->evaluate('string(.//div[@class="workshopItemTitle"])', $item),
        'author' => $xpath->evaluate('string(.//a[@class="workshop_author_link"])', $item),
        'publishedfileid' => $xpath->evaluate('string(.//a[@class="ugc"]/@data-publishedfileid)', $item),
        'image' => $xpath->evaluate('string(.//img[@class="workshopItemPreviewImage"]/@src)', $item),
        'rating' => $xpath->evaluate('string(.//img[@class="fileRating"]/@src)', $item)
    ];
}

echo json_encode($modsData);
?>