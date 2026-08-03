<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="app">
	<header>
		<div class="inner">
			<h1>Terraria Journey Tracker</h1>
			<p class="tagline">Research progress, live from your character file</p>
		</div>
	</header>

	<main>
		{@render children()}
	</main>

	<footer>
		<a href="https://github.com/enzomaruffa/terraria-journey-tracker-server">server</a>
		<span>·</span>
		<a href="https://github.com/enzomaruffa/terraria-journey-tracker-web-client">client</a>
		<span>·</span>
		<a href="https://terraria.wiki.gg">item data from terraria.wiki.gg</a>
	</footer>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	header {
		padding: 1.75rem 1rem 0;
	}

	.inner {
		max-width: 76rem;
		margin: 0 auto;
	}

	h1 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 650;
		letter-spacing: -0.015em;
	}

	.tagline {
		margin: 0.15rem 0 0;
		font-size: 0.82rem;
		color: var(--text-faint);
	}

	main {
		flex: 1;
		width: 100%;
		max-width: 76rem;
		margin: 0 auto;
		padding: 1.25rem 1rem 3rem;
		box-sizing: border-box;
	}

	footer {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		padding: 1.5rem 1rem 2rem;
		font-size: 0.75rem;
		color: var(--text-faint);
	}

	footer a {
		color: var(--text-faint);
	}

	footer a:hover {
		color: var(--text-muted);
	}
</style>
