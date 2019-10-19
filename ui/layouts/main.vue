<template>
    <div>
        <header>
            <h1>Vertest</h1>
            <div>
                <md-button v-for="(routeName, routePath) in routes"  v-bind:key="routePath"><a :href="routePath">{{ routeName }}</a></md-button>
            </div>
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