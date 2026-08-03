<script lang="ts">
	import StatCard from './StatCard.svelte';
	import type { ClosureResult } from '$lib/analysis/closure';
	import type { Progress } from '$lib/types';

	interface Props {
		progress: Progress;
		closure: ClosureResult | null;
	}

	let { progress, closure }: Props = $props();
	let overview = $derived(progress.overview);

	// The headline insight: chaining reaches far past the single step the tracker used to show.
	let chain = $derived(closure?.unlocked.length ?? 0);
	let multiplier = $derived(
		overview.craftableNow > 0 ? (chain / overview.craftableNow).toFixed(1) : '0'
	);
</script>

<section aria-label="Overview">
	<div class="hero panel">
		<div class="headline">
			<span class="pct num">{overview.percentItems}<span class="sign">%</span></span>
			<span class="of">
				<span class="label">of the catalogue researched</span>
				<span class="fraction num">
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
			label="chain-craftable"
			value={chain.toLocaleString()}
			sub={closure ? `${multiplier}x the one-step count` : ''}
			accent="cyan"
			glow
		/>
		<StatCard
			label="craftable now"
			value={overview.craftableNow.toLocaleString()}
			sub="one step, no chaining"
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
		<StatCard
			label="sacrificed"
			value={overview.sacrificesDone.toLocaleString()}
			sub="{overview.percentSacrifices}% of {overview.sacrificesTotal.toLocaleString()}"
		/>
	</div>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1rem 1.15rem 1.15rem;
		position: relative;
		overflow: hidden;
	}

	.hero::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(
			120% 100% at 0% 0%,
			color-mix(in srgb, var(--cyan) 9%, transparent),
			transparent 60%
		);
		pointer-events: none;
	}

	.headline {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.7rem;
	}

	.pct {
		font-size: 2.5rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--text);
		text-shadow: 0 0 24px color-mix(in srgb, var(--cyan) 30%, transparent);
	}

	.sign {
		font-size: 1.25rem;
		color: var(--text-muted);
		margin-left: 0.1rem;
	}

	.of {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.fraction {
		font-size: 0.75rem;
		color: var(--text-faint);
	}

	.bar {
		height: 0.5rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 999px;
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--green), var(--cyan) 65%, var(--magenta));
		box-shadow: var(--glow);
		transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.grid {
		display: grid;
		gap: 0.55rem;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
	}
</style>
