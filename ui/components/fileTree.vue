<template>
    <li>
        <div
                :class="{bold: isFolder}"
                @click="toggle">
            <span class="folder" v-if="isFolder">
                {{ item.name }}
            </span>
            <router-link v-if="!isFolder && displayLink && item.link" :to="item.link">
                {{ item.name }}
            </router-link>
            <span class="file" v-else-if="!isFolder" @click="$emit('open-item', item)">
                {{ item.name }}
            </span>
            <span class="status-icon" v-if="!isFolder && item.status">
                <test-case-state
                        :test-state="item.status"
                        :display-current-state="true"
                        :display-state-switch="false"
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
    ul {
        list-style-type: none;
        padding-left: 2em;
        li {
            position: relative;
            &:before,
            &:after {
                font-family: Material Icons;
                -webkit-font-feature-settings: "liga";
                font-feature-settings: "liga";
                position: absolute;
            }
            &:before {

                content: "more_horiz";
                top: 0.2em;
                left: -1em;
            }
            &:after {
                content: "more_vert";
                top: -0.4em;
                left: -1.3em;
            }
        }
        .folder {
            cursor: pointer;
            font-weight: bold;
        }
    }
</style>