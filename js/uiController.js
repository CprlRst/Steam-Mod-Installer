export class UIController {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    displayMods(mods) {
        if (!this.container) return;
        
        this.container.innerHTML = mods.length ? 
            this.createModsList(mods) : 
            '<div class="info">No mods installed</div>';
    }

    displayError(message) {
        this.container.innerHTML = `<div class="error">Error: ${message}</div>`;
    }

    createModsList(mods) {
        return mods.map(mod => `
            <div class="mod-item">
                <div class="mod-info">
                    <span class="mod-name">${mod.name}</span>
                    <span class="mod-id">ID: ${mod.id}</span>
                    <span class="mod-service">${mod.service}</span>
                </div>
                <button class="remove-mod" data-id="${mod.id}">Remove</button>
            </div>
        `).join('');
    }
}