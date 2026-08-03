<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		sub?: string;
		accent?: 'green' | 'blue' | 'amber' | 'neutral';
	}

	let { label, value, sub, accent = 'neutral' }: Props = $props();
</script>

<div class="card {accent}">
	<span class="value">{value}</span>
	<span class="label">{label}</span>
	<!-- Always rendered so cards in a row keep the same height. -->
	<span class="sub">{sub ?? ''}</span>
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.85rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.card::before {
		content: '';
		width: 1.75rem;
		height: 3px;
		margin-bottom: 0.5rem;
		border-radius: 999px;
		background: var(--accent);
	}

	.green {
		--accent: var(--green);
	}
	.blue {
		--accent: var(--blue);
	}
	.amber {
		--accent: var(--amber);
	}
	.neutral {
		--accent: var(--border-strong);
	}

	.value {
		font-size: 1.6rem;
		font-weight: 650;
		line-height: 1.15;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.label {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.sub {
		min-height: 1.15em;
		font-size: 0.72rem;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
	}
</style>
