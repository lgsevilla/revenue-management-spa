import { Component, OnInit, signal } from '@angular/core';
import { ApiService } from './services/api';
import { Config } from './models/config.model';
import { Week } from './models/week.model';
import { Kpis } from './models/kpis.model';
import { LastYearWeek } from './models/last-year.model';
import { ChartConfiguration, ChartData } from 'chart.js';
import { isoWeekLabel, getIsoWeek } from './utils/date-utils';

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
  last7VsLastYearPoints = signal<Array<{ label: string; actual: number | null; lastYear: number }>>([]);

  loadingConfig = signal(true);
  loadingWeeks = signal(true);
  loadingKpis = signal(true);
  loadingLastYear = signal(true);

  saving = signal(false);
  showDeleteModal = signal(false);

  private recomputeKpisFromWeeks(): void {
    const current = this.kpis()?.currentWeekEnding ?? '';

    const all = this.weeks();
    const currentRow = all.find(w => w.weekEnding === current);
    this.revenueToTargetCurrentWeek.set(currentRow?.revenueToTarget ?? 0);

    const nextRow = all.find(w => w.weekEnding > current);

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
      error: e => this.error.set(e?.message ?? 'Failed to load config'),
      complete: () => this.loadingConfig.set(false)
    });

    this.api.getWeeks(this.user).subscribe({
      next: w => {
        this.weeks.set([...w].sort((a, b) => a.weekEnding.localeCompare(b.weekEnding)));
        this.recomputeKpisFromWeeks();
        this.buildChartData();
      },
      error: e => this.error.set(e?.message ?? 'Failed to load weeks'),
      complete: () => this.loadingWeeks.set(false)
    });

    this.api.getKpis(this.user).subscribe({
      next: k => {
        this.kpis.set(k);
        this.recomputeKpisFromWeeks();
        this.buildChartData();
      },
      error: e => this.error.set(e?.message ?? 'Failed to load KPIs'),
      complete: () => this.loadingKpis.set(false)
    });

    this.api.getLastYear(this.user).subscribe({
      next: ly => {
        this.lastYear.set(ly);
        this.buildChartData();
      },
      error: e => this.error.set(e?.message ?? 'Failed to load last-year data'),
      complete: () => this.loadingLastYear.set(false)
    });
  }

  private refreshWeeks(): void {
    this.loadingWeeks.set(true);
    this.api.getWeeks(this.user).subscribe({
      next: w => {
        this.weeks.set([...w].sort((a, b) => a.weekEnding.localeCompare(b.weekEnding)));
        this.recomputeKpisFromWeeks();
        this.buildChartData();
      },
      error: e => this.error.set(e?.message ?? 'Failed to load weeks'),
      complete: () => this.loadingWeeks.set(false)
    });
  }

  submitForm(): void {
    if (this.saving()) return;

    this.message.set(null);
    this.error.set(null);
    this.saving.set(true);

    const weekEnding = this.form.weekEnding?.trim();
    if (!weekEnding) {
      this.error.set('weekEnding is required');
      this.saving.set(false);
      return;
    }

    type WeekUpsertPayload = {
      weekEnding: string;
      actualRevenue?: number;
      openOrders?: number;
      revenuePerFte?: number;
      targetRevenue?: number;
    };

    const payload: WeekUpsertPayload = { weekEnding };

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
      },
      complete: () => this.saving.set(false)
    });
  }

  deleteByWeekEnding(): void {
    if (this.saving()) return;

    this.message.set(null);
    this.error.set(null);
    this.saving.set(true);

    const weekEnding = this.form.weekEnding?.trim();
    if (!weekEnding) {
      this.error.set('weekEnding is required for delete');
      this.saving.set(false);
      return;
    }

    this.api.deleteWeek(this.user, weekEnding).subscribe({
      next: () => {
        this.message.set('Week deleted.');
        this.refreshWeeks();
      },
      error: (e) => {
        this.error.set(e?.error?.error ?? e?.message ?? 'Delete failed');
      },
      complete: () => this.saving.set(false)
    });
  }

  confirmDelete(): void {
    const weekEnding = this.form.weekEnding?.trim();
    if (!weekEnding) {
      this.error.set('weekEnding is required for delete');
      return;
    }

    this.showDeleteModal.set(true);
  }

  confirmDeleteAndRun(): void {
    this.showDeleteModal.set(false);
    this.deleteByWeekEnding();
  }

  private buildChartData(): void {
    const current = this.kpis()?.currentWeekEnding;
    const weeks = this.weeks();
    const lastYear = this.lastYear();

    if (!current || weeks.length === 0 || lastYear.length === 0) return;

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

    const lastYearByIsoWeek = new Map<string, number>();
      for (const ly of lastYear) {
        lastYearByIsoWeek.set(isoWeekLabel(ly.weekEnding), ly.actualRevenue);
      }

    this.last7VsLastYearPoints.set(
      last7.map(w => {
        const { weekYear, week } = getIsoWeek(w.weekEnding);
        const weekLabel = `W${String(week).padStart(2, "0")}`;
        const lastYearKey = `${weekYear - 1}-W${String(week).padStart(2, "0")}`;

        return {
          label: weekLabel,          
          actual: (w.actualRevenue && w.actualRevenue > 0) ? w.actualRevenue : null,
          lastYear: lastYearByIsoWeek.get(lastYearKey) ?? 0
        };
      })
    );

    // ---- bind Chart 1 (Target vs Actual) ----
    const p1 = this.targetVsActualPoints();

    const targetRevenue: number[] = p1.map(x => x.target);
    const actualRevenue: number[] = p1.map(x => x.actual);

    this.targetVsActualChartData = {
      labels: p1.map(x => x.weekEnding),
      datasets: [
        { label: 'Target Revenue', data: targetRevenue },
        { label: 'Actual Revenue', data: actualRevenue }
      ]
    };

    // ---- bind Chart 2 (Last 7 vs Last Year) ----
    const p2 = this.last7VsLastYearPoints();

    const actualSeries: (number | null)[] = p2.map(x => x.actual);
    const lastYearSeries: number[] = p2.map(x => x.lastYear);

    this.last7VsLastYearChartData = {
      labels: p2.map(x => x.label), 
      datasets: [
        { label: 'Actual Revenue', data: actualSeries },
        { label: 'Same Week Last Year', data: lastYearSeries }
      ]
    };
  }

  // Chart 1: Target vs Actual (7-week window)
  targetVsActualChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { label: 'Target Revenue', data: [] },
      { label: 'Actual Revenue', data: [] }
    ]
  };

  targetVsActualChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true
  };

  // Chart 2: Last 7 vs Last Year (line)
  last7VsLastYearChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      { label: 'Actual Revenue', data: [] },
      { label: 'Same Week Last Year', data: [] }
    ]
  };

  last7VsLastYearChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => `Week ${items[0].label?.replace('W', '')}`,
          label: (item) => {
            const val = item.parsed.y ?? 0;
            return `${item.dataset.label}: ${val.toLocaleString()}`;
          }
        }
      }
    }
  };
}