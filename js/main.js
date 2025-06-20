import { XMLParser } from './xmlParser.js';
import { UIController } from './uiController.js';
import { FTPHandler } from './ftpHandler.js';
import { CONFIG } from './config.js';
import { LocalHandler } from './localHandler.js';
import { WorkshopUrlBuilder } from './workshopUrlBuilder.js';

document.addEventListener('DOMContentLoaded', () => {
    // Core elements
    const elements = {
        modGrid: document.querySelector('.mod-grid'),
        searchInput: document.querySelector('#workshop-search-input'), // Updated selector
        searchButton: document.querySelector('#search-button'),
        sortSelect: document.querySelector('#sort-select'),
        typeSelect: document.querySelector('#type-select'), // Added type select
        categoryInputs: document.querySelectorAll('input[name="category"]'),
        modsContainer: document.querySelector('.mods-container'),
        configUpload: document.getElementById('config-upload'),
        localTab: document.getElementById('local-tab')
    };

    // Global state
    let configXmlContent = null;
    let currentMode = 'local';

    // Single Workshop Card Function
    function isModInstalled(modId, xmlContent) {
        if (!xmlContent) {
            console.warn('No config content available');
            return false;
        }
        
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            const modsSection = xmlDoc.querySelector('Mods');
            
            if (!modsSection) return false;
            
            const modItems = Array.from(modsSection.getElementsByTagName('ModItem'));
            return modItems.some(modItem => {
                const publishedFileId = modItem.querySelector('PublishedFileId');
                return publishedFileId && publishedFileId.textContent === modId;
            });
        } catch (error) {
            console.error('Error checking mod installation:', error);
            return false;
        }
    }

    function createModCard(mod) {
        if (!mod.id || !mod.image || !mod.title) {
            console.warn('Invalid mod data:', mod);
            return null;
        }

        const isInstalled = isModInstalled(mod.id, configXmlContent);
        const card = document.createElement('div');
        card.className = 'mod-card';
        card.innerHTML = `
            <img class="mod-card-image" src="${mod.image}" alt="${mod.title}">
            <div class="mod-card-content">
                <img class="mod-card-rating" src="${mod.rating}" alt="Rating">
                <h3 class="mod-card-title">${mod.title}</h3>
                <div class="mod-card-author">by ${mod.author}</div>
                <button class="mod-card-install ${isInstalled ? 'installed' : ''}" 
                        data-mod-id="${mod.id}">
                    ${isInstalled ? 'Remove Mod' : 'Install Mod'}
                </button>
            </div>
            <div class="mod-card-description">
                <h3 class="description-title">${mod.title}</h3>
                <p>${mod.description}</p>
            </div>
        `;

        // Add install/remove button handler
        const installButton = card.querySelector('.mod-card-install');
        installButton?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!configXmlContent) {
                alert('Please load a Sandbox_config.sbc file first');
                return;
            }

            const modId = e.target.dataset.modId;
            if (!modId) return;

            const isInstalled = e.target.classList.contains('installed');
            
            try {
                e.target.disabled = true;
                if (!isInstalled) {
                    e.target.textContent = 'Installing...';
                    await installModToConfig(modId);
                    e.target.textContent = 'Remove Mod';
                    e.target.classList.add('installed');
                } else {
                    e.target.textContent = 'Removing...';
                    await removeModFromConfig(modId);
                    e.target.textContent = 'Install Mod';
                    e.target.classList.remove('installed');
                }
                e.target.disabled = false;
            } catch (error) {
                console.error('Mod operation failed:', error);
                e.target.textContent = isInstalled ? 'Remove Failed' : 'Install Failed';
                e.target.classList.add('error');
                setTimeout(() => {
                    e.target.disabled = false;
                    e.target.textContent = isInstalled ? 'Remove Mod' : 'Install Mod';
                    e.target.classList.remove('error');
                }, 3000);
            }
        });

        return card;
    }

    // Single install handler function
    async function handleModInstall(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!configXmlContent) {
            alert('Please load a Sandbox_config.sbc file first');
            return;
        }

        const modId = e.target.dataset.modId;
        if (!modId) return;

        const installButton = e.target;
        const isInstalled = installButton.classList.contains('installed');

        try {
            installButton.disabled = true;
            
            if (!isInstalled) {
                installButton.textContent = 'Installing...';
                await installModToConfig(modId);
                installButton.textContent = 'Remove Mod';
                installButton.classList.add('installed');
            } else {
                installButton.textContent = 'Removing...';
                await removeModFromConfig(modId);
                installButton.textContent = 'Install Mod';
                installButton.classList.remove('installed');
            }
            
            installButton.disabled = false;
        } catch (error) {
            console.error('Mod operation failed:', error);
            handleInstallError(installButton, isInstalled);
        }
    }

    async function installModToConfig(modId) {
        if (!configXmlContent) {
            throw new Error('No config file loaded');
        }

        // Check if mod is already installed
        const isInstalled = isModInstalled(modId, configXmlContent);
        if (isInstalled) {
            throw new Error('Mod is already installed');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(configXmlContent, 'text/xml');
        
        let modsSection = xmlDoc.querySelector('Mods');
        if (!modsSection) {
            modsSection = xmlDoc.createElement('Mods');
            xmlDoc.documentElement.appendChild(modsSection);
        }

        // Create new mod entry with correct format
        const modItem = xmlDoc.createElement('ModItem');
        modItem.setAttribute('FriendlyName', '');
        modItem.innerHTML = `
            <Name>${modId}.sbm</Name>
            <PublishedFileId>${modId}</PublishedFileId>
            <PublishedServiceName>Steam</PublishedServiceName>
        `;

        modsSection.appendChild(modItem);
        configXmlContent = new XMLSerializer().serializeToString(xmlDoc);

        // After updating XML, refresh all mod cards to show current state
        const cards = document.querySelectorAll('.mod-card');
        cards.forEach(card => {
            const cardModId = card.querySelector('.mod-card-install').dataset.modId;
            if (cardModId) {
                const button = card.querySelector('.mod-card-install');
                const isNowInstalled = isModInstalled(cardModId, configXmlContent);
                button.textContent = isNowInstalled ? 'Remove Mod' : 'Install Mod';
                button.classList.toggle('installed', isNowInstalled);
            }
        });

        if (currentMode === 'ftp') {
            await uploadToFTP(configXmlContent);
        } else {
            showDownloadButton();
        }
    }

    async function removeModFromConfig(modId) {
        if (!configXmlContent) {
            throw new Error('No config file loaded');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(configXmlContent, 'text/xml');
        
        const modsSection = xmlDoc.querySelector('Mods');
        if (!modsSection) {
            throw new Error('No mods section found');
        }

        const modItems = modsSection.getElementsByTagName('ModItem');
        const modToRemove = Array.from(modItems).find(mod => 
            mod.querySelector('PublishedFileId')?.textContent === modId
        );

        if (!modToRemove) {
            throw new Error('Mod not found in config');
        }

        modsSection.removeChild(modToRemove);
        configXmlContent = new XMLSerializer().serializeToString(xmlDoc);

        // Handle FTP or local mode
        if (currentMode === 'ftp') {
            await uploadToFTP(configXmlContent);
        } else {
            showDownloadButton();
        }
    }

    // Single Workshop Parse Function
    async function parseWorkshopItems(params = {}) {
        if (!elements.modGrid) return;

        try {
            // Convert parameters to URL search params
            const searchParams = new URLSearchParams();
            if (params.searchText) searchParams.append('searchText', params.searchText);
            if (params.sort) searchParams.append('sort', params.sort);
            if (params.type) searchParams.append('type', params.type);
            if (params.categories?.length) {
                searchParams.append('categories', JSON.stringify(params.categories));
            }

            const response = await fetch(`fetch-workshop.php?${searchParams.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            elements.modGrid.innerHTML = '';
            
            if (!data.mods?.length) {
                elements.modGrid.innerHTML = '<div class="info">No mods found</div>';
                return;
            }

            data.mods.forEach(mod => {
                if (mod.id) {
                    mod.isInstalled = isModInstalled(mod.id, configXmlContent);
                    const card = createModCard(mod);
                    if (card) elements.modGrid.appendChild(card);
                }
            });
        } catch (error) {
            console.error('Workshop error:', error);
            elements.modGrid.innerHTML = `<div class="error">${error.message}</div>`;
        }
    }

    // Remove duplicate event listeners and function calls
    function updateModsList() {
        const params = {
            sort: elements.sortSelect?.value || 'totaluniquesubscribers',
            type: elements.typeSelect?.value || '', // Updated for type select
            searchText: elements.searchInput?.value || '',
            categories: Array.from(elements.categoryInputs || [])
                .filter(input => input.checked)
                .map(input => input.value)
        };

        // Update URL with new parameters
        const workshopUrl = WorkshopUrlBuilder.buildUrl(params);
        history.replaceState(null, '', `?${new URLSearchParams(params).toString()}`);
        
        parseWorkshopItems(params);
    }

    // Add debounced search
    let searchTimeout;
    elements.searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            updateModsList();
        }, 500);
    });

    // Clear filters button
    const clearFiltersButton = document.createElement('button');
    clearFiltersButton.textContent = 'Clear Filters';
    clearFiltersButton.className = 'clear-filters-btn';
    clearFiltersButton.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.sortSelect.value = 'totaluniquesubscribers';
        elements.typeSelect.value = '';
        elements.categoryInputs.forEach(input => input.checked = false);
        updateModsList();
    });

    // Single set of workshop event listeners
    if (elements.modGrid) {
        elements.sortSelect?.addEventListener('change', updateModsList);
        elements.searchButton?.addEventListener('click', updateModsList);
        elements.typeSelect?.addEventListener('change', updateModsList); // Added type select listener
        elements.categoryInputs?.forEach(input => 
            input.addEventListener('change', updateModsList));

        // Single initial load
        parseWorkshopItems();
    }

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');
            
            // Hide all tab contents
            tabContents.forEach(content => {
                content.style.display = 'none';
            });
            
            // Show selected tab content
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).style.display = 'block';
            currentMode = button.getAttribute('data-tab');
        });
    });

    // Local file handler
    const modFileInput = document.getElementById('config-upload');
    modFileInput?.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        configXmlContent = e.target.result;
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(configXmlContent, 'text/xml');
                        
                        // Check for parsing errors
                        const parseError = xmlDoc.querySelector('parsererror');
                        if (parseError) {
                            throw new Error('Invalid XML file');
                        }

                        // Find Mods section
                        const modsSection = xmlDoc.querySelector('Mods');
                        if (!modsSection) {
                            elements.modsContainer.innerHTML = '<div class="info">No mods installed</div>';
                            return;
                        }

                        // Extract and display mods
                        const modItems = modsSection.getElementsByTagName('ModItem');
                        const mods = Array.from(modItems).map(mod => ({
                            name: mod.querySelector('Name')?.textContent || 'Unknown',
                            id: mod.querySelector('PublishedFileId')?.textContent || 'Unknown',
                            service: mod.querySelector('PublishedServiceName')?.textContent || 'Steam'
                        }));

                        displayMods(mods);
                    } catch (error) {
                        console.error('File read error:', error);
                        displayError(error.message);
                    }
                };
                reader.readAsText(file);
            } catch (error) {
                console.error('File read error:', error);
                displayError(error.message);
            }
        }
    });

    // FTP handler
    const ftpForm = document.getElementById('ftp-form');
    const ftpHandler = new FTPHandler();

    ftpForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const connectButton = e.target.querySelector('button[type="submit"]');
        
        try {
            connectButton.disabled = true;
            connectButton.textContent = 'Connecting...';

            // Connect and get config content
            const configContent = await ftpHandler.connect(e.target);
            configXmlContent = configContent;
            currentMode = 'ftp';

            // Update UI
            connectButton.textContent = 'Connected';
            connectButton.classList.add('connected');
            displayInfo('FTP Connection successful');

            // Update mod cards to show installation status
            updateModsList();
            
        } catch (error) {
            console.error('FTP Error:', error);
            displayError(`FTP Connection failed: ${error.message}`);
            connectButton.textContent = 'Connect';
            connectButton.classList.remove('connected');
            configXmlContent = null;
            currentMode = 'local';
        } finally {
            connectButton.disabled = false;
        }
    });

    function parseModsSection(xmlContent) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        const modsSection = xmlDoc.querySelector('Mods');
        
        if (!modsSection) {
            displayInfo('No mods section found - Creating new section');
            return [];
        }

        const modItems = modsSection.getElementsByTagName('ModItem');
        return Array.from(modItems).map(mod => ({
            name: mod.querySelector('Name')?.textContent || 'Unknown',
            id: mod.querySelector('PublishedFileId')?.textContent || 'Unknown',
            service: mod.querySelector('PublishedServiceName')?.textContent || CONFIG.DEFAULT_SERVICE
        }));
    }

    function displayMods(mods) {
        if (!elements.modsContainer) return;
        
        elements.modsContainer.innerHTML = mods.length ? mods.map(mod => `
            <div class="mod-item">
                <div class="mod-info">
                    <span class="mod-name">${mod.name}</span>
                    <span class="mod-id">ID: ${mod.id}</span>
                </div>
                <button class="remove-mod" data-id="${mod.id}">Remove</button>
            </div>
        `).join('') : '<div class="info">No mods installed</div>';
    }

    function displayError(message) {
        if (!elements.modsContainer) return;
        elements.modsContainer.innerHTML = `<div class="error">Error: ${message}</div>`;
    }

    function displayInfo(message) {
        if (!elements.modsContainer) return;
        elements.modsContainer.innerHTML = `<div class="info">${message}</div>`;
    }

    function removeMod(modId) {
        try {
            console.log('Starting mod removal for ID:', modId);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(configXmlContent, 'text/xml');
            
            const modsSection = xmlDoc.querySelector('Mods');
            if (!modsSection) {
                console.error('No mods section found');
                return false;
            }

            const modItems = modsSection.getElementsByTagName('ModItem');
            console.log('Found mod items:', modItems.length);

            const modToRemove = Array.from(modItems).find(mod => 
                mod.querySelector('PublishedFileId')?.textContent === modId
            );

            if (modToRemove) {
                modsSection.removeChild(modToRemove);
                configXmlContent = new XMLSerializer().serializeToString(xmlDoc);
                console.log('Updated XML content length:', configXmlContent.length);
                
                parseAndDisplayMods(configXmlContent);
                showDownloadButton();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error in removeMod:', error);
            return false;
        }
    }

    async function removeModFTP(modId) {
        try {
            console.log('Starting FTP mod removal for ID:', modId);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(configXmlContent, 'text/xml');
            
            const modsSection = xmlDoc.querySelector('Mods');
            if (!modsSection) {
                console.error('No mods section found');
                return false;
            }

            const modItems = modsSection.getElementsByTagName('ModItem');
            const modToRemove = Array.from(modItems).find(mod => 
                mod.querySelector('PublishedFileId')?.textContent === modId
            );

            if (modToRemove) {
                // Remove mod from XML
                modsSection.removeChild(modToRemove);
                const updatedXml = new XMLSerializer().serializeToString(xmlDoc);
                
                // Upload to server
                const formData = new FormData();
                formData.append('action', 'update');
                formData.append('content', updatedXml);
                formData.append('type', document.querySelector('#ftp-form select[name="type"]').value);
                formData.append('host', document.querySelector('#ftp-form input[name="host"]').value);
                formData.append('username', document.querySelector('#ftp-form input[name="username"]').value);
                formData.append('password', document.querySelector('#ftp-form input[name="password"]').value);
                formData.append('path', document.querySelector('#ftp-form input[name="path"]').value);

                const response = await fetch('ftp-handler.php', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'Failed to update server');
                }

                // Fetch updated file from server
                configXmlContent = result.data;
                parseAndDisplayMods(configXmlContent);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error in FTP mod removal:', error);
            displayError(`Failed to remove mod: ${error.message}`);
            return false;
        }
    }

    function parseAndDisplayMods(xmlContent) {
        console.log('Parsing updated XML');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        const modsSection = xmlDoc.querySelector('Mods');
        
        if (!modsSection) {
            console.log('No mods section found after parsing');
            displayMods([]);
            return;
        }

        const modItems = modsSection.getElementsByTagName('ModItem');
        console.log('Found mods after parsing:', modItems.length);
        
        const mods = Array.from(modItems).map(mod => ({
            name: mod.querySelector('Name')?.textContent || 'Unknown',
            id: mod.querySelector('PublishedFileId')?.textContent || 'Unknown',
            service: mod.querySelector('PublishedServiceName')?.textContent || 'Steam'
        }));

        displayMods(mods);
    }

    function showDownloadButton() {
        const localTab = document.getElementById('local-tab');
        let downloadBtn = document.getElementById('download-config');
        
        if (!downloadBtn) {
            downloadBtn = document.createElement('button');
            downloadBtn.id = 'download-config';
            downloadBtn.className = 'download-btn';
            downloadBtn.textContent = 'Download Updated Config';
            downloadBtn.onclick = () => downloadConfig(configXmlContent);
            localTab.querySelector('.file-upload-container').appendChild(downloadBtn);
        }
    }

    function downloadConfig(content) {
        const blob = new Blob([content], { type: 'text/xml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Sandbox_config.sbc';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    async function uploadToFTP(content) {
        if (!ftpHandler.isConnected) {
            throw new Error('Please connect to FTP server first');
        }

        try {
            const updatedContent = await ftpHandler.upload(content);
            configXmlContent = updatedContent; // Update global content
            displayInfo('File uploaded successfully');
            return true;
        } catch (error) {
            console.error('FTP upload error:', error);
            displayError(`Upload failed: ${error.message}`);
            throw error;
        }
    }

    // Update click handler to handle both modes
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-mod')) {
            const modId = e.target.dataset.id;
            const currentTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
            
            e.target.disabled = true;
            e.target.textContent = 'Removing...';
            
            try {
                const success = currentTab === 'ftp' ? 
                    await removeModFTP(modId) : 
                    await removeMod(modId);
                    
                if (success) {
                    console.log('Mod removed successfully');
                }
            } catch (error) {
                console.error('Error removing mod:', error);
                displayError(error.message);
            } finally {
                e.target.disabled = false;
                e.target.textContent = 'Remove';
            }
        }
    });

    document.addEventListener('click', (e) => {
        const card = e.target.closest('.mod-card');
        if (card) {
            const url = card.dataset.url;
            if (url) {
                window.open(url, '_blank');
            }
        }
    });

    function installMod(modId) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(configXmlContent, 'text/xml');
            
            let modsSection = xmlDoc.querySelector('Mods');
            if (!modsSection) {
                modsSection = xmlDoc.createElement('Mods');
                const settings = xmlDoc.querySelector('Settings');
                if (settings) {
                    settings.parentNode.insertBefore(modsSection, settings.nextSibling);
                } else {
                    xmlDoc.documentElement.appendChild(modsSection);
                }
            }

            // Check if mod already exists
            const existingMod = modsSection.querySelector(`ModItem:has(PublishedFileId:contains("${modId}"))`);
            if (existingMod) {
                throw new Error('Mod already installed');
            }

            // Create new mod entry
            const modEntry = CONFIG.MOD_TEMPLATE.replace(/{modId}/g, modId);
            const modFragment = parser.parseFromString(modEntry, 'text/xml').documentElement;
            modsSection.appendChild(modFragment);

            // Update XML content
            configXmlContent = new XMLSerializer().serializeToString(xmlDoc);

            return true;
        } catch (error) {
            console.error('Error installing mod:', error);
            return false;
        }
    }

    // Keep only the config file handling code at the bottom
    const configUpload = document.getElementById('config-upload');
    configUpload?.addEventListener('change', handleConfigUpload);

    async function handleConfigUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            configXmlContent = await file.text();
            
            // Validate XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(configXmlContent, 'text/xml');
            
            if (xmlDoc.querySelector('parsererror')) {
                throw new Error('Invalid XML file');
            }

            // Update mod cards to show installation status
            updateModsList();
            
            // Show success message using elements object
            if (elements.modsContainer) {
                elements.modsContainer.innerHTML = '<div class="success">Config file loaded successfully</div>';
            }
        } catch (error) {
            console.error('Failed to load config file:', error);
            alert('Failed to load config file: ' + error.message);
            if (elements.modsContainer) {
                elements.modsContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            }
        }
    }

    // Single event listener for config upload
    if (elements.configUpload) {
        elements.configUpload.removeEventListener('change', handleConfigUpload);
        elements.configUpload.addEventListener('change', handleConfigUpload);
    }
});