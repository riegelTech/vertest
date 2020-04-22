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
                        <md-icon>assignment</md-icon>
                        <span class="md-list-item-text"><router-link to="/">Test suites</router-link></span>
                    </md-list-item>
                    <md-list-item>
                        <md-icon>group</md-icon>
                        <span class="md-list-item-text"><router-link to="/users">Users</router-link></span>
                    </md-list-item>
                    <md-list-item>
                        <md-icon>vpn_key</md-icon>
                        <span class="md-list-item-text"><router-link to="/ssh-keys">SSH keys</router-link></span>
                    </md-list-item>
                </md-list>
            </md-drawer>
            <md-drawer class="md-right" :md-active.sync="showSidepanel" v-if="currentUser">
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
        <md-content>
            <slot></slot>
        </md-content>
        <footer></footer>
    </div>
</template>

<script src="./main.js">
</script>
<style scoped lang="scss">
    .page-container {
        height: 100%;
        min-height: 300px;
        overflow: hidden;
        position: relative;
    }
</style>