<script lang="ts">
	import StatCard from './StatCard.svelte';
	import type { Progress } from '$lib/types';

	interface Props {
		progress: Progress;
	}

	let { progress }: Props = $props();
	let overview = $derived(progress.overview);
</script>

<section aria-label="Overview">
	<div class="hero">
		<div class="headline">
			<span class="pct">{overview.percentItems}<span class="sign">%</span></span>
			<span class="of">
				of the catalogue researched
				<span class="fraction">
					{overview.itemsResearched.toLocaleString()} / {overview.itemsTotal.toLocaleString()}
				</span>
			</span>
		</div>

		<div
			class="bar"
			role="progressbar"
			aria-valuenow={overview.percentItems}
			aria-valuemin="0"
			aria-valuemax="100"
			aria-label="Items researched"
		>
			<div class="fill" style="width: {Math.max(overview.percentItems, 0.6)}%"></div>
		</div>
	</div>

	<div class="grid">
		<StatCard
			label="craftable right now"
			value={overview.craftableNow.toLocaleString()}
			sub="ingredients ready"
			accent="blue"
		/>
		<StatCard
			label="in progress"
			value={overview.itemsPartial.toLocaleString()}
			sub="started, not finished"
			accent="amber"
		/>
		<StatCard
			label="researched"
			value={overview.itemsResearched.toLocaleString()}
			sub="fully unlocked"
			accent="green"
		/>
		<StatCard label="not started" value={overview.itemsUntouched.toLocaleString()} />
		<StatCard
			label="items sacrificed"
			value={overview.sacrificesDone.toLocaleString()}
			sub="{overview.percentSacrifices}% of {overview.sacrificesTotal.toLocaleString()}"
		/>
	</div>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.1rem 1.25rem 1.25rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.headline {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.pct {
		font-size: 2.6rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}

	.sign {
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--text-muted);
		margin-left: 0.1rem;
	}

	.of {
		display: flex;
		flex-direction: column;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.fraction {
		font-size: 0.78rem;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
	}

	.bar {
		height: 0.6rem;
		background: var(--bg);
		border-radius: 999px;
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--green), var(--blue));
		transition: width 0.45s ease;
	}

	.grid {
		display: grid;
		gap: 0.7rem;
		grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
	}
</style>
