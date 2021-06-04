<template>
    <li :class="{root: item.name == 'root', lastchild : item.isLastChild}" >
        <div
                class="treeLine"
                :class="{bold: isFolder}"
                @click="toggle">
            <span class="folder" v-if="isFolder">
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
        </div>
        <ul v-show="isOpen" v-if="isFolder && item.children">
            <file-tree
                    class="item"
                    v-for="(child, index) in item.children"
                    :key="index"
                    :item="child"
                    :display-link="displayLink"
                    @open-item="$emit('open-item', $event)"
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
        }
        li.root {
            border-left: none;
        }
    }
</style>