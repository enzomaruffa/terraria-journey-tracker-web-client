<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		sub?: string;
		accent?: 'cyan' | 'green' | 'amber' | 'magenta' | 'neutral';
		glow?: boolean;
	}

	let { label, value, sub, accent = 'neutral', glow = false }: Props = $props();
</script>

<div class="card {accent}" class:glow>
	<span class="label">{label}</span>
	<span class="value num">{value}</span>
	<!-- Always rendered so cards in a row keep the same height. -->
	<span class="sub num">{sub ?? ''}</span>
</div>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.75rem 0.85rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	/* Corner tick, so the panels read as instrumentation rather than plain boxes. */
	.card::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 10px;
		height: 10px;
		border-top: 1px solid var(--accent);
		border-right: 1px solid var(--accent);
		opacity: 0.7;
	}

	.cyan {
		--accent: var(--cyan);
	}
	.green {
		--accent: var(--green);
	}
	.amber {
		--accent: var(--amber);
	}
	.magenta {
		--accent: var(--magenta);
	}
	.neutral {
		--accent: var(--border-strong);
	}

	.value {
		font-size: 1.5rem;
		font-weight: 650;
		line-height: 1.15;
		letter-spacing: -0.02em;
		color: var(--accent);
	}

	.neutral .value {
		color: var(--text);
	}

	.glow .value {
		text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 55%, transparent);
	}

	.sub {
		min-height: 1.1em;
		font-size: 0.68rem;
		color: var(--text-faint);
	}
</style>
