// ─── setInterval-based scheduler (unref'd: never keeps the process alive) ───
import { IntervalScheduler, type ScheduledTask } from '../../application/ports/interval-scheduler.port';

export class NodeIntervalScheduler extends IntervalScheduler {
    every(ms: number, task: () => void): ScheduledTask {
        const timer = setInterval(task, ms);
        timer.unref();
        return { cancel: () => { clearInterval(timer); } };
    }
}
