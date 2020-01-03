'use strict';

import {userMixin} from '../pages/users/users';

export default {
	mixins: [userMixin],
	data: () => ({
		showNavigation: false,
		showSidepanel: false
	})
};
