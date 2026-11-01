// ─── The wording of the crew board's move suggestions, Thai (default) and English ───
// Pure data + functions, like domain/planning/labels.en.ts: suggest.ts builds the lines through these so the board can
// show them in the UI language. Names (crews, projects, plan tasks) arrive already in the right language.

export interface SuggestWords {
    /** "งานฉาบปูน บ้านคุณวิชัย" · "Plastering (Wichai House)". */
    what(taskName: string, projectName: string): string;
    /** "ทีมก่อฉาบช่างดำ" (a crew name without ทีม gets it); the crew name as is in English. */
    team(name: string): string;
    resolveMoveTitle(what: string, team: string): string;
    resolveDelayTitle(what: string, day: string): string;
    helpTitle(team: string, what: string, days: number): string;
    fillOtherTitle(team: string, what: string, earlier: number): string;
    fillSameTitle(what: string, earlier: number): string;
    noLongerClashes(project: string): string;
    finishUnchanged(project: string): string;
    crewFreeThen(team: string, days: number): string;
    crewFreeFrom(team: string, day: string): string;
    similarPace: string;
    readyFrom(waited: boolean, day: string): string;
    knockOns(n: number): string;
    pulls(n: number): string;
    labour(up: boolean, amount: string): string;
    finishMoved(project: string, earlier: boolean, days: number, change: string): string;
    // describeChange
    addChange(team: string, what: string, range: string): string;
    pushed(days: number, range: string): string;
    earlier(days: number, range: string): string;
    shortened(range: string, was: string): string;
    extended(range: string, was: string): string;
    unchanged(range: string): string;
}

const TH: SuggestWords = {
    what: (task, project) => `${task.startsWith('งาน') ? task : `งาน${task}`} ${project}`,
    team: name => {
        if (name.startsWith('ทีม')) return name;
        return /^[฀-๿]/.test(name) ? `ทีม${name}` : `ทีม ${name}`;
    },
    resolveMoveTitle: (what, team) => `ย้าย${what} ไปให้${team}`,
    resolveDelayTitle: (what, day) => `เลื่อน${what} ไปเริ่ม ${day}`,
    helpTitle: (team, what, days) => `ให้${team} ไปช่วย${what} ${String(days)} วัน`,
    fillOtherTitle: (team, what, earlier) => `ให้${team} ทำ${what} เริ่มเร็วขึ้น ${String(earlier)} วัน`,
    fillSameTitle: (what, earlier) => `เริ่ม${what} เร็วขึ้น ${String(earlier)} วัน`,
    noLongerClashes: project => `ไม่ชนกับงาน${project}อีก`,
    finishUnchanged: project => `วันเสร็จของ${project}ไม่เปลี่ยน`,
    crewFreeThen: (team, days) => `${team}ว่างอยู่ช่วงนั้น ${String(days)} วัน`,
    crewFreeFrom: (team, day) => `${team}ว่างตั้งแต่ ${day}`,
    similarPace: 'คิดว่าสองทีมทำงานได้เร็วพอกัน',
    readyFrom: (waited, day) => `${waited ? 'งานก่อนหน้าเสร็จและครบช่วงรอแล้ว' : 'งานก่อนหน้าเสร็จแล้ว'}ตั้งแต่ ${day}`,
    knockOns: n => `มีงานที่ต้องเลื่อนตาม ${String(n)} งาน`,
    pulls: n => `งานถัดไปเริ่มเร็วขึ้นตาม ${String(n)} งาน`,
    labour: (up, amount) => `ค่าแรง${up ? 'เพิ่ม' : 'ลดลง'} ${amount}`,
    finishMoved: (project, earlier, days, change) => `${project}${earlier ? 'เสร็จเร็วขึ้น' : 'เสร็จช้าลง'} ${String(days)} วัน (${change})`,
    addChange: (team, what, range) => `เพิ่ม ${team} ช่วย${what} ${range}`,
    pushed: (days, range) => `เลื่อนไป ${String(days)} วัน (${range})`,
    earlier: (days, range) => `เร็วขึ้น ${String(days)} วัน (${range})`,
    shortened: (range, was) => `เหลือ ${range} (เดิมถึง ${was})`,
    extended: (range, was) => `ขยายเป็น ${range} (เดิมถึง ${was})`,
    unchanged: range => `ไม่เปลี่ยน (${range})`,
};

const unit = (n: number) => (n === 1 ? 'day' : 'days');
const tasks = (n: number) => (n === 1 ? 'task' : 'tasks');

const EN: SuggestWords = {
    what: (task, project) => `${task} (${project})`,
    team: name => name,
    resolveMoveTitle: (what, team) => `Move ${what} to ${team}`,
    resolveDelayTitle: (what, day) => `Delay ${what} to start on ${day}`,
    helpTitle: (team, what, days) => `Send ${team} to help with ${what} for ${String(days)} ${unit(days)}`,
    fillOtherTitle: (team, what, earlier) => `Have ${team} do ${what}, starting ${String(earlier)} ${unit(earlier)} earlier`,
    fillSameTitle: (what, earlier) => `Start ${what} ${String(earlier)} ${unit(earlier)} earlier`,
    noLongerClashes: project => `No longer clashes with work on ${project}`,
    finishUnchanged: project => `The finish date of ${project} does not change`,
    crewFreeThen: (team, days) => `${team} is free for ${String(days)} ${unit(days)} then`,
    crewFreeFrom: (team, day) => `${team} is free from ${day}`,
    similarPace: 'Assumes the two crews work at about the same pace',
    readyFrom: (waited, day) => (waited
        ? `The previous task has been finished and its wait is over since ${day}`
        : `The previous task has been finished since ${day}`),
    knockOns: n => `${String(n)} ${tasks(n)} must be pushed back`,
    pulls: n => `${String(n)} following ${tasks(n)} start earlier`,
    labour: (up, amount) => `Labour cost ${up ? 'up' : 'down'} ${amount}`,
    finishMoved: (project, earlier, days, change) => `${project} finishes ${String(days)} ${unit(days)} ${earlier ? 'earlier' : 'later'} (${change})`,
    addChange: (team, what, range) => `Add ${team} to help with ${what} ${range}`,
    pushed: (days, range) => `Pushed back ${String(days)} ${unit(days)} (${range})`,
    earlier: (days, range) => `Brought forward ${String(days)} ${unit(days)} (${range})`,
    shortened: (range, was) => `Shortened to ${range} (was until ${was})`,
    extended: (range, was) => `Extended to ${range} (was until ${was})`,
    unchanged: range => `No change (${range})`,
};

export const suggestWords = (locale: string): SuggestWords => (locale === 'en' ? EN : TH);
