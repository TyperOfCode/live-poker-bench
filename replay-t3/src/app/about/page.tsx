import { Header } from "~/components/layout";

export default function AboutPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <div className="flex-1 overflow-auto">
        <AboutContent />
      </div>
    </div>
  );
}

function AboutContent() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <article className="prose prose-invert prose-lg max-w-none">
        <h1 className="mb-2 text-3xl font-bold text-white">What is LivePokerBench?</h1>
        <p className="mb-8 text-lg text-gray-400">
          A benchmark for evaluating LLM agents on strategic reasoning, adaptation, and
          decision-making under uncertainty.
        </p>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">Overview</h2>
          <p className="leading-relaxed text-gray-300">
            LivePokerBench is a reproducible benchmark where up to 8 AI agents (LLMs) compete
            in fixed-format No-Limit Texas Hold&apos;em poker tournaments. It measures multi-agent
            decision-making under imperfect information by scoring tournament placement across
            multiple runs.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">Why Poker?</h2>
          <p className="mb-4 leading-relaxed text-gray-300">
            Poker provides a uniquely challenging environment for evaluating AI reasoning capabilities:
          </p>
          <ul className="list-none space-y-3 pl-0 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="mt-1 text-blue-400">&#8226;</span>
              <span><strong className="text-white">Probabilistic outcomes</strong> — Unlike chess or Go,
              optimal decisions don&apos;t guarantee optimal results. Agents must reason about expected value
              over distributions.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-blue-400">&#8226;</span>
              <span><strong className="text-white">Imperfect information</strong> — Agents only see their
              own cards and public actions. They must model opponent behavior from incomplete data.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-blue-400">&#8226;</span>
              <span><strong className="text-white">Multi-agent dynamics</strong> — Success depends not just
              on strategy, but on adapting to how other agents play. Each tournament is a unique competitive
              ecosystem.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-blue-400">&#8226;</span>
              <span><strong className="text-white">Memory and adaptation</strong> — Agents can recall past
              hands to identify opponent patterns and adjust their strategy over time.</span>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">What Does It Measure?</h2>
          <p className="mb-4 leading-relaxed text-gray-300">
            LivePokerBench evaluates several key capabilities:
          </p>
          <div className="grid gap-4">
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h3 className="mb-2 font-medium text-white">Strategic Reasoning</h3>
              <p className="text-sm text-gray-400">
                Can the agent correctly assess hand strength, pot odds, and opponent ranges?
                Does it make mathematically sound decisions?
              </p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h3 className="mb-2 font-medium text-white">Adaptation</h3>
              <p className="text-sm text-gray-400">
                Does the agent adjust its strategy based on opponent behavior? Can it exploit
                predictable patterns while avoiding exploitation itself?
              </p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h3 className="mb-2 font-medium text-white">Decision-Making Under Uncertainty</h3>
              <p className="text-sm text-gray-400">
                How does the agent handle situations with incomplete information? Does it
                appropriately weigh risk vs reward?
              </p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h3 className="mb-2 font-medium text-white">Consistency</h3>
              <p className="text-sm text-gray-400">
                Does the agent produce valid actions reliably? Invalid action rates reveal
                instruction-following capability.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">How It Works</h2>

          <h3 className="mb-3 mt-6 text-lg font-medium text-white">Tournament Format</h3>
          <p className="mb-4 leading-relaxed text-gray-300">
            Each tournament runs a 6-player (default) No-Limit Hold&apos;em sit-and-go. Players start
            with 100 big blinds. Blinds increase every 20 hands to ensure convergence. The last
            agent with chips wins.
          </p>

          <h3 className="mb-3 mt-6 text-lg font-medium text-white">Agent Architecture</h3>
          <p className="mb-4 leading-relaxed text-gray-300">
            Agents operate under true imperfect information — they only see what a real player
            would legally observe. Each decision allows multiple LLM calls with access to memory
            tools:
          </p>
          <ul className="list-none space-y-2 pl-0 text-gray-300">
            <li className="flex items-start gap-3">
              <code className="rounded bg-gray-800 px-2 py-0.5 text-sm text-blue-400">recall_opponent_actions</code>
              <span className="text-sm">Query past actions by a specific opponent</span>
            </li>
            <li className="flex items-start gap-3">
              <code className="rounded bg-gray-800 px-2 py-0.5 text-sm text-blue-400">recall_my_hands</code>
              <span className="text-sm">Retrieve history of the agent&apos;s own hands</span>
            </li>
            <li className="flex items-start gap-3">
              <code className="rounded bg-gray-800 px-2 py-0.5 text-sm text-blue-400">search_observations</code>
              <span className="text-sm">Supposed to be free-text search across observation history, but its broken RIP.</span>
            </li>
          </ul>
          <p className="mt-4 text-sm text-gray-400">
            Importantly, agents have <em>no access to solvers, equity calculators, or GTO tools</em>.
            All strategic reasoning must emerge from the LLM itself.
          </p>

          <h3 className="mb-3 mt-6 text-lg font-medium text-white">Scoring</h3>
          <p className="leading-relaxed text-gray-300">
            To control for poker&apos;s inherent variance, the benchmark runs <strong>K=10 tournaments</strong> with
            different random seeds. The primary metric is <strong>average placement percentile</strong> across
            all runs. Secondary metrics include win rate, invalid action rate, and token usage.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">Key Design Principles</h2>
          <ul className="list-none space-y-3 pl-0 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="mt-1 text-green-400">&#10003;</span>
              <span><strong className="text-white">Reproducibility</strong> — Seeded decks ensure
              identical card distributions across runs with the same seed.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-green-400">&#10003;</span>
              <span><strong className="text-white">Fair information</strong> — Strict enforcement
              of what each agent can observe prevents information leakage.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-green-400">&#10003;</span>
              <span><strong className="text-white">Model-agnostic</strong> — Any LLM accessible
              via API can be dropped in as an agent.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-green-400">&#10003;</span>
              <span><strong className="text-white">Full transparency</strong> — Every decision,
              reasoning trace, and tool call is logged for analysis.</span>
            </li>
          </ul>
        </section>

        <section className="border-t border-gray-700 pt-8">
          <p className="text-sm text-gray-500">
            LivePokerBench is designed to evaluate how LLMs perform in environments where
            optimal play requires reasoning about probability, opponent modeling, and
            long-term strategy — capabilities that extend far beyond pattern matching.
          </p>
        </section>
      </article>
    </div>
  );
}
