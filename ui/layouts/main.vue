<template>
    <div class="page-container md-layout-column">
        <header>
            <md-toolbar class="md-primary">
                <md-button class="md-icon-button" @click="showNavigation = true">
                    <md-icon>menu</md-icon>
                </md-button>
                <h1 class="md-title">Vertest</h1>
                <div class="md-toolbar-section-end" v-if="currentUser !== null">
                    <md-button @click="showSidepanel = true">{{ currentUser.firstName }} {{ currentUser.lastName }}</md-button>
                </div>
            </md-toolbar>
            <md-drawer :md-active.sync="showNavigation" md-swipeable>
                <md-toolbar class="md-transparent" md-elevation="0">
                    <span class="md-title">My App name</span>
                </md-toolbar>

                <md-list>
                    <md-list-item>
                        <md-icon>home</md-icon>
                        <span class="md-list-item-text"><router-link to="/">Home</router-link></span>
                    </md-list-item>
                    <md-list-item>
                        <md-icon>group</md-icon>
                        <span class="md-list-item-text"><router-link to="/users">Users</router-link></span>
                    </md-list-item>
                    <md-list-item>
                        <md-icon>assignment</md-icon>
                        <span class="md-list-item-text"><router-link to="/test-suites">Test-suites</router-link></span>
                    </md-list-item>
                    <md-list-item>
                        <md-icon>all_inbox</md-icon>
                        <span class="md-list-item-text"><router-link to="/repositories">Repositories</router-link></span>
                    </md-list-item>
                </md-list>
            </md-drawer>
            <md-drawer class="md-right" :md-active.sync="showSidepanel" v-if="currentUser !== null">
                <md-toolbar class="md-transparent" md-elevation="0">
                    <span class="md-title">{{ currentUser.firstName }} {{ currentUser.lastName }}</span>
                </md-toolbar>
                <md-list>
                    <md-list-item>
                        <md-button class="md-icon-button" @click="logout">
                            <md-icon class="md-primary">meeting_room</md-icon>
                            <md-tooltip md-direction="top">Logout</md-tooltip>
                        </md-button>
                    </md-list-item>
                </md-list>
            </md-drawer>
        </header>
        <div>
            <slot></slot>
        </div>
        <footer></footer>
    </div>
</template>

<script src="./main.js">
</script>
<style scoped>
</style>