<template>
    <div class="diff-viewer">
        <table v-for="hunk in hunks">
            <tr v-for="(oldLine, oldLineIndex) in hunk.oldLines.content" class="less">
                <td>{{ oldLineIndex + hunk.oldLines.start }}</td>
                <td>-</td>
                <td>{{ oldLine }}</td>
            </tr>
            <tr v-for="(newLine, newLineIndex) in hunk.newLines.content" class="more">
                <td>{{ newLineIndex + hunk.newLines.start }}</td>
                <td>+</td>
                <td>{{ newLine }}</td>
            </tr>
        </table>
    </div>
</template>
<script>
    export default {
        name: 'diff-viewer',
        props: {
            hunks: Array
        }
    };
</script>
<style scoped lang="scss">
    .diff-viewer{
        table {
            border: none;
            border-collapse: collapse;
            border-spacing: 0;
            tr, td {
                vertical-align: top;
                border: none;
            }
            tr.less td {
                background-color: #f00;
            }
            tr.more td {
                background-color: #0f0;
            }
        }
    }
</style>