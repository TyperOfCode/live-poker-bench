export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <article className="prose prose-invert prose-lg max-w-none">
        <h1 className="text-3xl font-bold text-white mb-2">What is LivePokerBench?</h1>
        <p className="text-gray-400 text-lg mb-8">
          A benchmark for evaluating LLM agents on strategic reasoning, adaptation, and
          decision-making under uncertainty.
        </p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-4">Overview</h2>
          <p className="text-gray-300 leading-relaxed">
            LivePokerBench is a reproducible benchmark where up to 8 AI agents (LLMs) compete
            in fixed-format No-Limit Texas Hold'em poker tournaments. It measures multi-agent
            decision-making under imperfect information by scoring tournament placement across
            multiple runs.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-4">Why Poker?</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Poker provides a uniquely challenging environment for evaluating AI reasoning capabilities:
          </p>
          <ul className="text-gray-300 space-y-3 list-none pl-0">
            <li className="flex items-start gap-3">
              <span className="text-blue-400 mt-1">&#8226;</span>
              <span><strong className="text-white">Probabilistic outcomes</strong> — Unlike chess or Go,
              optimal decisions don't guarantee optimal results. Agents must reason about expected value
              over distributions.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-400 mt-1">&#8226;</span>
              <span><strong className="text-white">Imperfect information</strong> — Agents only see their
              own cards and public actions. They must model opponent behavior from incomplete data.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-400 mt-1">&#8226;</span>
              <span><strong className="text-white">Multi-agent dynamics</strong> — Success depends not just
              on strategy, but on adapting to how other agents play. Each tournament is a unique competitive
              ecosystem.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-400 mt-1">&#8226;</span>
              <span><strong className="text-white">Memory and adaptation</strong> — Agents can recall past
              hands to identify opponent patterns and adjust their strategy over time.</span>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-4">What Does It Measure?</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            LivePokerBench evaluates several key capabilities:
          </p>
          <div className="grid gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Strategic Reasoning</h3>
              <p className="text-gray-400 text-sm">
                Can the agent correctly assess hand strength, pot odds, and opponent ranges?
                Does it make mathematically sound decisions?
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Adaptation</h3>
              <p className="text-gray-400 text-sm">
                Does the agent adjust its strategy based on opponent behavior? Can it exploit
                predictable patterns while avoiding exploitation itself?
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Decision-Making Under Uncertainty</h3>
              <p className="text-gray-400 text-sm">
                How does the agent handle situations with incomplete information? Does it
                appropriately weigh risk vs reward?
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Consistency</h3>
              <p className="text-gray-400 text-sm">
                Does the agent produce valid actions reliably? Invalid action rates reveal
                instruction-following capability.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-4">How It Works</h2>

          <h3 className="text-lg font-medium text-white mt-6 mb-3">Tournament Format</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Each tournament runs a 6-player (default) No-Limit Hold'em sit-and-go. Players start
            with 100 big blinds. Blinds increase every 20 hands to ensure convergence. The last
            agent with chips wins.
          </p>

          <h3 className="text-lg font-medium text-white mt-6 mb-3">Agent Architecture</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Agents operate under true imperfect information — they only see what a real player
            would legally observe. Each decision allows multiple LLM calls with access to memory
            tools:
          </p>
          <ul className="text-gray-300 space-y-2 list-none pl-0">
            <li className="flex items-start gap-3">
              <code className="text-blue-400 text-sm bg-gray-800 px-2 py-0.5 rounded">recall_opponent_actions</code>
              <span className="text-sm">Query past actions by a specific opponent</span>
            </li>
            <li className="flex items-start gap-3">
              <code className="text-blue-400 text-sm bg-gray-800 px-2 py-0.5 rounded">recall_my_hands</code>
              <span className="text-sm">Retrieve history of the agent's own hands</span>
            </li>
            <li className="flex items-start gap-3">
              <code className="text-blue-400 text-sm bg-gray-800 px-2 py-0.5 rounded">search_observations</code>
              <span className="text-sm">Supposed to be free-text search across observation history, but its broken RIP.</span>
            </li>
          </ul>
          <p className="text-gray-400 text-sm mt-4">
            Importantly, agents have <em>no access to solvers, equity calculators, or GTO tools</em>.
            All strategic reasoning must emerge from the LLM itself.
          </p>

          <h3 className="text-lg font-medium text-white mt-6 mb-3">Scoring</h3>
          <p className="text-gray-300 leading-relaxed">
            To control for poker's inherent variance, the benchmark runs <strong>K=10 tournaments</strong> with
            different random seeds. The primary metric is <strong>average placement percentile</strong> across
            all runs. Secondary metrics include win rate, invalid action rate, and token usage.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-4">Key Design Principles</h2>
          <ul className="text-gray-300 space-y-3 list-none pl-0">
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">&#10003;</span>
              <span><strong className="text-white">Reproducibility</strong> — Seeded decks ensure
              identical card distributions across runs with the same seed.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">&#10003;</span>
              <span><strong className="text-white">Fair information</strong> — Strict enforcement
              of what each agent can observe prevents information leakage.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">&#10003;</span>
              <span><strong className="text-white">Model-agnostic</strong> — Any LLM accessible
              via API can be dropped in as an agent.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">&#10003;</span>
              <span><strong className="text-white">Full transparency</strong> — Every decision,
              reasoning trace, and tool call is logged for analysis.</span>
            </li>
          </ul>
        </section>

        <section className="border-t border-gray-700 pt-8">
          <p className="text-gray-500 text-sm">
            LivePokerBench is designed to evaluate how LLMs perform in environments where
            optimal play requires reasoning about probability, opponent modeling, and
            long-term strategy — capabilities that extend far beyond pattern matching.
          </p>
        </section>
      </article>
    </div>
  );
}

export default AboutPage;
