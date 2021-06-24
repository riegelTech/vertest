<template>
    <div class="diff-viewer">
        <table>
            <tbody v-for="hunk in sortedHunks">
                <tr v-for="(oldLine, oldLineIndex) in hunk.oldLines.content" class="less">
                    <td class="num-line">{{ oldLineIndex + hunk.oldLines.start }}</td>
                    <td class="sign-line">-</td>
                    <td class="content">{{ oldLine }}</td>
                </tr>
                <tr v-for="(newLine, newLineIndex) in hunk.newLines.content" class="more">
                    <td class="num-line">{{ newLineIndex + hunk.newLines.start }}</td>
                    <td class="sign-line">+</td>
                    <td class="content">{{ newLine }}</td>
                </tr>
                <tr v-for="(existingLine, existingLineIndex) in hunk.existingLines.content" class="same">
                    <td class="num-line">{{ existingLineIndex + hunk.existingLines.start }}</td>
                    <td class="sign-line"></td>
                    <td class="content">{{ existingLine }}</td>
                </tr>
                <tr v-if="hunk.hunks && hunk.hunks.length > 0" class="sub-hunks" :class="{ 'less' : hunk.oldLines.content, 'more' : hunk.newLines.content, 'same' : hunk.existingLines.content }">
                    <td class="num-line"></td>
                    <td class="sign-line"></td>
                    <td>
                        <diff-viewer :hunks="hunk.hunks"></diff-viewer>
                    </td>
                </tr>
            </tbody>
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
                &.sub-hunks, &.sub-hunks>td {
                    padding: 0 0 10px 0;
                    table {
                        width: 100%;
                    }
                }
                &.num-line {
                    width: 25px;
                }
            }
            tr.less > td {
                background-color: #fdaeb7;;
                &.content {
                    background-color: #ffeef0;
                }
            }
            tr.more > td {
                background-color: #bef5cb;
                &.content {
                    background-color: #cdffd8;
                }
            }
            tr.same > td {
                background-color: #bbbbbb;
                &.content {
                    background-color: #eeeeee;
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
        },
        data() {
        	return {
        		sortedHunks: []
            }
        },
        mounted() {
			this.sortedHunks = this.hunks.map(hunk => {
				return Object.assign({
					oldLines: {},
					newLines: {},
					existingLines: {}
				}, hunk);
            });

			this.sortedHunks.sort((hunkA, hunkB) => {
				const startA = hunkA.oldLines.start || hunkA.newLines.start || hunkA.existingLines.start;
				const startB = hunkB.oldLines.start || hunkB.newLines.start || hunkB.existingLines.start;

				if (startA === startB) {
					return 0;
                }
				return startA < startB ? -1 : 1;
            });
        }
    };
</script>
