import { Component, OnInit, signal } from '@angular/core';
import { ApiService } from './services/api';
import { Config } from './models/config.model';
import { Week } from './models/week.model';
import { Kpis } from './models/kpis.model';
import { LastYearWeek } from './models/last-year.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit {
  config = signal<Config | null>(null);
  weeks = signal<Week[]>([]);
  error = signal<string | null>(null);

  kpis = signal<Kpis | null>(null);
  lastYear = signal<LastYearWeek[]>([]);

  fteNeededNextWeek = signal<number>(0);
  revenueToTargetCurrentWeek = signal<number>(0);

  targetVsActualPoints = signal<Array<{ weekEnding: string; target: number; actual: number }>>([]);
  last7VsLastYearPoints = signal<Array<{ weekEnding: string; actual: number; lastYear: number }>>([]);

  private recomputeKpisFromWeeks(): void {
    const current = this.kpis()?.currentWeekEnding ?? '';

    const all = this.weeks();
    const currentRow = all.find(w => w.weekEnding === current);
    this.revenueToTargetCurrentWeek.set(currentRow?.revenueToTarget ?? 0);

    // next week: first weekEnding that is greater than current (ISO strings compare safely)
    const nextRow = all
      .filter(w => w.weekEnding > current)
      .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))[0];

    this.fteNeededNextWeek.set(nextRow?.fteToTarget ?? 0);
  }

  form = {
    weekEnding: '',
    actualRevenue: null as number | null,
    openOrders: null as number | null,
    revenuePerFte: null as number | null,
    targetRevenue: null as number | null
  };

  message = signal<string | null>(null);

  // simulate a restricted user for now (matches your API users)
  user = 'laurence';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getConfig(this.user).subscribe({
      next: c => this.config.set(c),
      error: e => this.error.set(e?.message ?? 'Failed to load config')
    });

    this.api.getWeeks(this.user).subscribe({
      next: w => this.weeks.set(
        [...w].sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
      ),
      error: e => this.error.set(e?.message ?? 'Failed to load weeks')
    });

    this.api.getKpis(this.user).subscribe({
      next: k => {
        this.kpis.set(k);
        this.recomputeKpisFromWeeks();
        this.buildChartData();
      },
      error: e => this.error.set(e?.message ?? 'Failed to load KPIs')
    });

    this.api.getLastYear(this.user).subscribe({
      next: ly => {
        this.lastYear.set(ly);
        this.buildChartData();
      },
      error: e => this.error.set(e?.message ?? 'Failed to load last-year data')
    });
  }

  private refreshWeeks(): void {
    this.api.getWeeks(this.user).subscribe({
      next: w => {
        this.weeks.set([...w].sort((a, b) => a.weekEnding.localeCompare(b.weekEnding)));
        this.recomputeKpisFromWeeks();
        this.buildChartData();
      },
      error: e => this.error.set(e?.message ?? 'Failed to load weeks')
    });
  }

  submitForm(): void {
    this.message.set(null);
    this.error.set(null);

    const weekEnding = this.form.weekEnding?.trim();
    if (!weekEnding) {
      this.error.set('weekEnding is required');
      return;
    }

    const payload: any = { weekEnding };

    if (this.form.actualRevenue !== null) payload.actualRevenue = this.form.actualRevenue;
    if (this.form.openOrders !== null) payload.openOrders = this.form.openOrders;
    if (this.form.revenuePerFte !== null) payload.revenuePerFte = this.form.revenuePerFte;
    if (this.form.targetRevenue !== null) payload.targetRevenue = this.form.targetRevenue;

    const exists = this.weeks().some(w => w.weekEnding === weekEnding);

    const req$ = exists
      ? this.api.updateWeek(this.user, weekEnding, payload)
      : this.api.createWeek(this.user, payload);

    req$.subscribe({
      next: () => {
        this.message.set(exists ? 'Week updated.' : 'Week created.');
        this.refreshWeeks();
      },
      error: (e) => {
        this.error.set(e?.error?.error ?? e?.message ?? 'Save failed');
      }
    });
  }

  deleteByWeekEnding(): void {
    this.message.set(null);
    this.error.set(null);

    const weekEnding = this.form.weekEnding?.trim();
    if (!weekEnding) {
      this.error.set('weekEnding is required for delete');
      return;
    }

    this.api.deleteWeek(this.user, weekEnding).subscribe({
      next: () => {
        this.message.set('Week deleted.');
        this.refreshWeeks();
      },
      error: (e) => {
        this.error.set(e?.error?.error ?? e?.message ?? 'Delete failed');
      }
    });
  }

  private buildChartData(): void {
    const current = this.kpis()?.currentWeekEnding;
    const weeks = this.weeks();
    const lastYear = this.lastYear();

    if (!current || weeks.length === 0) return;

    const sorted = [...weeks].sort((a, b) => a.weekEnding.localeCompare(b.weekEnding));

    const currentIndex = sorted.findIndex(w => w.weekEnding === current);

    const centerIndex = currentIndex !== -1 ? currentIndex : Math.max(0, sorted.length - 1);
    const start = Math.max(0, centerIndex - 3);
    const end = Math.min(sorted.length, centerIndex + 4);

    const window7 = sorted.slice(start, end);

    this.targetVsActualPoints.set(
      window7.map(w => ({
        weekEnding: w.weekEnding,
        target: w.targetRevenue,
        actual: w.actualRevenue ?? 0
      }))
    );

    const last7 = sorted.slice(Math.max(0, sorted.length - 7));

    function minusOneYearISO(iso: string): string {
      const d = new Date(iso + "T00:00:00");
      d.setFullYear(d.getFullYear() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    const lastYearMap = new Map(lastYear.map(x => [x.weekEnding, x.actualRevenue]));

    this.last7VsLastYearPoints.set(
      last7.map(w => {
        const lyKey = minusOneYearISO(w.weekEnding);
        return {
          weekEnding: w.weekEnding,
          actual: w.actualRevenue ?? 0,
          lastYear: lastYearMap.get(lyKey) ?? 0
        };
      })
    );
  }
}