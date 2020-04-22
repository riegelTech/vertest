<template>
    <div class="diff-viewer">
        <table v-for="hunk in hunks">
            <tr v-for="(oldLine, oldLineIndex) in hunk.oldLines.content" class="less">
                <td>{{ oldLineIndex + hunk.oldLines.start }}</td>
                <td>-</td>
                <td class="content">{{ oldLine }}</td>
            </tr>
            <tr v-for="(newLine, newLineIndex) in hunk.newLines.content" class="more">
                <td>{{ newLineIndex + hunk.newLines.start }}</td>
                <td>+</td>
                <td class="content">{{ newLine }}</td>
            </tr>
        </table>
    </div>
</template>
<style scoped lang="scss">
    .diff-viewer{
        table {
            border: none;
            border-collapse: collapse;
            border-spacing: 0;
            tr, td {
                vertical-align: top;
                border: none;
                padding: 5px;
            }
            tr.less td {
                background-color: #fdaeb7;;
                &.content {
                    background-color: #ffeef0;
                }
            }
            tr.more td {
                background-color: #bef5cb;
                &.content {
                    background-color: #cdffd8;
                }
            }
        }
    }
</style>
<script>
    export default {
        name: 'diff-viewer',
        props: {
            hunks: Array
        }
    };
</script>
