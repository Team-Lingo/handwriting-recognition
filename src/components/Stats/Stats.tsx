import "./Stats.css";

type Stat = {
  value: string;
  label: string;
};

const STATS: Stat[] = [
  { value: "99.5%", label: "Accuracy Rate" },
  { value: "500k+", label: "Users Worldwide" },
  { value: "10M+", label: "Documents Processed" },
  { value: "50+", label: "Languages Supported" },
];

export default function Stats() {
  return (
    <section className="stats section" aria-labelledby="stats-heading">
      <div className="container stats-wrap">
        {STATS.map((s) => (
          <div key={s.label} className="stat-item">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
