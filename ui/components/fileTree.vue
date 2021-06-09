<template>
    <li :class="{root: item.name == 'root', lastchild : item.isLastChild}" >
        <div
                class="treeLine"
                :class="{bold: isFolder}"
                >
            <span class="folder" v-if="isFolder" @click="toggle">
                {{ item.name }}
            </span>
            <router-link class="file" v-if="!isFolder && displayLink && item.link" :to="item.link">
                {{ item.name }}
            </router-link>
            <span class="file" v-else-if="!isFolder" @click="$emit('open-item', item)">
                {{ item.name }}
            </span>
            <span class="status-icon" v-if="!isFolder && item.status">
                <test-case-state
                        :testState="item.status"
                        :display-current-state="true"
                        :display-state-switch="false"
                        :user="item.user"
                ></test-case-state>
            </span>
            <md-button v-if="displaySelectors" class="md-icon-button md-pico" @click="$emit('select-item', item)">
                <md-icon>add</md-icon>
                <md-tooltip md-direction="top" v-if="isFolder">Select all this directory's content</md-tooltip>
                <md-tooltip md-direction="top" v-else>Select this file</md-tooltip>
            </md-button>
            <md-button v-if="displaySelectors" class="md-icon-button md-pico" @click="$emit('unselect-item', item)">
                <md-icon>remove</md-icon>
                <md-tooltip md-direction="top" v-if="isFolder">Unselect all this directory's content</md-tooltip>
                <md-tooltip md-direction="top" v-else>Unselect this file</md-tooltip>
            </md-button>
        </div>
        <ul v-show="isOpen" v-if="isFolder && item.children">
            <file-tree
                    class="item"
                    v-for="(child, index) in item.children"
                    :key="index"
                    :item="child"
                    :display-link="displayLink"
                    :display-selectors="displaySelectors"
                    @select-item="$emit('select-item', $event)"
                    @unselect-item="$emit('unselect-item', $event)"
            ></file-tree>
        </ul>
    </li>
</template>

<script src="./fileTree.js"></script>

<style scoped lang="scss">
    $grey-light: #999;
    ul {
        list-style-type: none;
        padding-left: 0;
        li {
            position: relative;
            border-left: 1px solid #999;
            padding-left: 14px;
            left: 1px;
            &.lastchild {
                border-left: none;
                &:after {
                    position: absolute;
                    content: " ";
                    top: -1px;
                    left: 0;
                    width: 0px;
                    height: 11px;
                    border-left: 1px solid $grey-light;
                }
            }
            &:before {
                position: absolute;
                content: " ";
                top: 10px;
                left: 0;
                width: 13px;
                height: 0px;
                border-top: 1px solid $grey-light  ;
            }
            .treeLine {
                white-space: nowrap;
            }
            .folder {
                cursor: pointer;
                font-weight: bold;
            }
            .file {
                cursor: pointer;
            }
            .md-icon-button.md-pico{
                margin: 3px 0 0;
            }
        }
        li.root {
            border-left: none;
        }
    }
</style>