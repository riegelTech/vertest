<template>
    <div>
        <header>
            <h1>Vertest</h1>
            <div>
                <md-button><router-link to="/">Home</router-link></md-button>
                <md-button><router-link to="/users">Users</router-link></md-button>
                <md-button><router-link to="/test-suites">Test-suites</router-link></md-button>
                <md-button><router-link to="/repositories">Repositories</router-link></md-button>
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