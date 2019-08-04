<template>
    <board></board>
</template>

<script>
	import Board from '../../components/board/board.vue'
    export default {
		components: {
			Board
        },
        render (h) {
			return h(Board);
        }
    }
</script>

<style scoped>

</style>