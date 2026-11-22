// 몽글믹스 — 같이 사냥 동기화
// 한 사람(host)이 몬스터를 움직이고, 다른 사람(guest)은 그 모습을 받아서 보여 준다.
// guest가 때린 건 host에게 보내고, 몬스터가 guest를 때린 건 guest에게 보낸다.
const r1 = v => Math.round(v * 10) / 10;

export class Sync {
  constructor(game, ui, state) {
    Object.assign(this, { game, ui, state });
    this.link = null;
    this.partner = null; // 상대가 보낸 최신 위치 정보
    this.sendT = 0;
    game.sync = this;
  }

  get on() { return !!this.link; }

  attach(link, amHost) {
    if (this.link) this.detach();
    this.link = link;
    this.host = amHost;
    link.onmessage = m => this.recv(m);
    if (amHost) this.game.mode = 'host';
    else this.game.enterGuest();
    this.ui.toast('🤝 같이 사냥 연결! 이제 같은 몬스터가 보여요');
    this.ui.setLinked(true);
  }

  detach() {
    if (!this.link) return;
    this.link = null;
    this.partner = null;
    if (this.game.mode === 'guest') this.game.leaveGuest();
    else this.game.removeAllies();
    this.game.mode = 'solo';
    this.ui.setLinked(false);
  }

  send(o) { this.link?.send(o); }

  update(dt) {
    if (!this.link) return;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = 0.1;
    const g = this.game, h = g.hero, hp = h.model.root.position;
    const pets = g.units.filter(u => u.kind === 'pet').map(u => {
      const p = u.model.root.position;
      return [u.slot, u.sp, u.data.shiny ? 1 : 0, r1(p.x), r1(p.z), r1(u.face), u.dead ? 1 : 0, u.moving ? 1 : 0, Math.round(u.hp), u.maxHp];
    });
    this.send({ t: 'p', n: this.state.name, l: this.state.look, lv: this.state.lv,
      h: [r1(hp.x), r1(hp.z), r1(h.face), h.dead ? 1 : 0, Math.round(h.hp), h.maxHp, h.moving ? 1 : 0], pets });
    if (this.host) {
      const m = g.units.filter(u => u.kind === 'wild' && !u.removed).map(u => {
        const p = u.model.root.position;
        return [u.nid, u.sp, u.lv, r1(p.x), r1(p.z), r1(u.face), Math.round(Math.max(0, u.hp)), u.maxHp,
          (u.dead ? 1 : 0) | (u.boss ? 2 : 0) | (u.moving ? 4 : 0) | (u.minion ? 8 : 0)];
      });
      this.send({ t: 'w', m });
    }
  }

  recv(m) {
    const g = this.game;
    switch (m.t) {
      case 'p': this.partner = m; if (this.host) g.updateAllies(m); break;
      case 'w': if (!this.host) g.applyWorld(m.m); break;
      case 'hit': if (this.host) g.remoteHit(m); break;
      case 'hurt': if (!this.host) g.remoteHurt(m); break;
      case 'kill': if (!this.host) g.remoteKill(m); break;
      case 'fx': g.remoteFx(m); break;
    }
  }
}
