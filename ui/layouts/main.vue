<template>
    <div class="page-container md-layout-column">
        <header>
            <md-toolbar class="md-primary">
                <md-button class="md-icon-button" @click="showNavigation = true">
                    <md-icon>menu</md-icon>
                </md-button>
                <h1 class="md-title"><router-link :to="`/${$i18n.locale}/`">Vertest</router-link></h1>
                <div class="md-toolbar-section-end">
                    <router-link to="/fr/" class="country-flag"><gb-flag code="fr" size="small" /></router-link>
                    <router-link to="/en/" class="country-flag"><gb-flag code="us" size="small" /></router-link>
                    <md-button v-if="currentUser !== null" @click="showSidepanel = true">{{ currentUser.firstName }} {{ currentUser.lastName }}</md-button>
                </div>
            </md-toolbar>
            <md-drawer :md-active.sync="showNavigation" md-swipeable>
                <md-toolbar class="md-transparent" md-elevation="0">
                    <span class="md-title">Vertest</span>
                </md-toolbar>
                <md-list>
                    <md-list-item>
                        <md-icon>assignment</md-icon>
                        <span class="md-list-item-text"><router-link :to="`/${$i18n.locale}/`">Test suites</router-link></span>
                    </md-list-item>
                    <md-list-item>
                        <md-icon>group</md-icon>
                        <span class="md-list-item-text"><router-link :to="`/${$i18n.locale}/users`">Users</router-link></span>
                    </md-list-item>
                    <md-list-item>
                        <md-icon>vpn_key</md-icon>
                        <span class="md-list-item-text"><router-link :to="`/${$i18n.locale}/ssh-keys`">SSH keys</router-link></span>
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
                            <md-tooltip md-direction="top">{{ $t("common.Logout") }}</md-tooltip>
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
<style scoped lang="scss" src="./main.scss"></style>
<style lang="scss" src="./custom.scss"></style>
<style lang="scss" src="./global.scss"></style>