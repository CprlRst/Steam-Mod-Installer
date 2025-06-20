export class WorkshopUrlBuilder {
    static CONSTANTS = {
        BASE_URL: 'workshop-proxy.php',
        APP_ID: '244850',
        SORT_OPTIONS: ['totaluniquesubscribers', 'trend', 'mostrecent', 'lastupdated'],
        TYPE_OPTIONS: ['World', 'Mod', 'Blueprint', 'IngameScript', 'Scenario'],
        CATEGORIES: ['Block', 'Exploration', 'Respawn+Ship', 'Script', 'Modpack', 'Skybox']
    };

    constructor() {
        this.params = new URLSearchParams({
            appid: WorkshopUrlBuilder.CONSTANTS.APP_ID,
            section: 'readytouseitems'
        });
    }

    setSearch(searchText) {
        if (searchText) {
            this.params.set('searchtext', searchText);
        }
        return this;
    }

    setSort(sortBy) {
        if (WorkshopUrlBuilder.CONSTANTS.SORT_OPTIONS.includes(sortBy)) {
            this.params.set('browsesort', sortBy);
        }
        return this;
    }

    setType(type) {
        if (WorkshopUrlBuilder.CONSTANTS.TYPE_OPTIONS.includes(type)) {
            this.params.append('requiredtags[]', type);
        }
        return this;
    }

    setCategory(category) {
        if (WorkshopUrlBuilder.CONSTANTS.CATEGORIES.includes(category)) {
            this.params.append('requiredtags[]', category);
        }
        return this;
    }

    build() {
        return `${WorkshopUrlBuilder.CONSTANTS.BASE_URL}?${this.params.toString()}`;
    }

    buildProxyRequest() {
        const steamUrl = `https://steamcommunity.com/workshop/browse/?${this.params.toString()}`;
        return {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `url=${encodeURIComponent(steamUrl)}`
        };
    }

    async fetch() {
        try {
            const response = await fetch(
                WorkshopUrlBuilder.CONSTANTS.BASE_URL, 
                this.buildProxyRequest()
            );
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to load workshop data');
            }
            return data;
        } catch (error) {
            throw new Error(`Workshop fetch failed: ${error.message}`);
        }
    }

    static buildUrl(params) {
        const baseUrl = 'https://steamcommunity.com/workshop/browse/?appid=244850';
        const urlParams = new URLSearchParams();

        // Add sorting
        if (params.sort) {
            urlParams.append('browsesort', params.sort);
        }

        // Add search text
        if (params.searchText) {
            urlParams.append('searchtext', params.searchText);
        }

        // Add type filter
        if (params.type) {
            urlParams.append('type', params.type);
        }

        // Add categories
        if (params.categories && params.categories.length > 0) {
            params.categories.forEach(category => {
                urlParams.append('requiredtags[]', category);
            });
        }

        return `${baseUrl}&${urlParams.toString()}`;
    }
}