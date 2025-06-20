import { CONFIG } from './config.js';

export class XMLParser {
    static parseModsSection(xmlContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            if (xmlDoc.querySelector('parsererror')) {
                throw new Error('XML parsing failed');
            }

            const rootElement = xmlDoc.documentElement;
            if (!rootElement || rootElement.tagName !== CONFIG.XML_ROOT) {
                throw new Error('Invalid config file format');
            }

            return this.extractMods(rootElement);
        } catch (error) {
            console.error('XML Parse Error:', error);
            throw error;
        }
    }

    static extractMods(rootElement) {
        const modsSection = rootElement.querySelector('Mods');
        if (!modsSection) return [];

        const modItems = modsSection.getElementsByTagName('ModItem');
        return Array.from(modItems).map(mod => ({
            name: mod.querySelector('Name')?.textContent || 'Unknown',
            id: mod.querySelector('PublishedFileId')?.textContent || 'Unknown',
            service: mod.querySelector('PublishedServiceName')?.textContent || CONFIG.DEFAULT_SERVICE
        }));
    }
}