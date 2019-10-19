'use strict';

import routes from '../../app/static-routing';

export default {
    data() {
        return {
            routes: {}
        }
    },
    mounted() {
        this.routes = routes.pages;
    }
}