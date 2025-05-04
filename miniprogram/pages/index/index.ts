// index.ts
// 获取应用实例
const app = getApp<IAppOption>()
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Component({
  data: {
    step: 0, // 0: 輸入暱稱, 1: 輸入薪資, 2: 主畫面
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
    },
    salary: '', // 月薪
    workingDays: '', // 月工作日
    dailySalary: 0, // 日薪
    secondSalary: 0, // 秒薪
    todayEarnings: 0, // 今日所得
    isClockedIn: false, // 是否已打卡
    timer: null as any, // 跳錢計時器
    waveTimer: null as any, // 波浪動畫計時器
    plusList: [] as Array<{id: number, top: number, opacity: number, value: string}>, // +1動畫列表
    plusId: 0, // 遞增id
  },
  methods: {
    // 事件处理函数
    bindViewTap() {
      wx.navigateTo({
        url: '../logs/logs',
      })
    },
    onChooseAvatar(e: any) {
      const { avatarUrl } = e.detail
      const { nickName } = this.data.userInfo
      this.setData({
        "userInfo.avatarUrl": avatarUrl,
        hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
      })
    },
    onInputChange(e: any) {
      const { type } = e.target.dataset;
      const value = e.detail.value;
      if (type === 'nickname') {
        this.setData({ "userInfo.nickName": value });
        if (value && value.trim()) {
          this.setData({ step: 1 });
        }
      } else if (type === 'salary') {
        this.setData({ salary: value });
      } else if (type === 'workingDays') {
        this.setData({ workingDays: value });
      }
      // 若月薪與工作日都有輸入，計算日薪與秒薪
      const salary = Number(type === 'salary' ? value : this.data.salary);
      const workingDays = Number(type === 'workingDays' ? value : this.data.workingDays);
      if (salary > 0 && workingDays > 0) {
        const dailySalary = Math.floor(salary / workingDays);
        const secondSalary = +(dailySalary / (8 * 60 * 60)).toFixed(4);
        this.setData({ dailySalary, secondSalary, step: 2 }, () => {
          this.drawWave();
        });
      }
    },
    // 繪製水位波浪
    drawWave() {
      const query = wx.createSelectorQuery().in(this);
      query.select('#waveCanvas').fields({ node: true, size: true }).exec(res => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const width = 480;
        const height = 480;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        // 畫圓形遮罩
        ctx.save();
        ctx.beginPath();
        ctx.arc(width/2, height/2, width/2-8, 0, 2*Math.PI);
        ctx.clip();
        // 水位百分比
        const percent = Math.min(this.data.todayEarnings / (this.data.dailySalary || 1), 1);
        // 波浪參數
        const waveHeight = 16;
        const waveLength = width / 1.2;
        const now = Date.now() / 600;
        ctx.beginPath();
        for (let x = 0; x <= width; x++) {
          const theta = (x / waveLength) * 2 * Math.PI + now;
          const y = height * (1 - percent) + Math.sin(theta) * waveHeight;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = '#60a5fa';
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.restore();
      });
    },
    getUserProfile() {
      // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
      wx.getUserProfile({
        desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
        success: (res) => {
          console.log(res)
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    },
    onClockIn() {
      if (!this.data.dailySalary) {
        wx.showToast({ title: '請先輸入月薪與工作日', icon: 'none' });
        return;
      }
      this.setData({ isClockedIn: true, todayEarnings: 0 }, () => {
        this.drawWave();
      });
      // 跳錢計時器
      if (this.data.timer) clearInterval(this.data.timer);
      if (this.data.waveTimer) clearInterval(this.data.waveTimer);
      const that = this;
      const timer = setInterval(function() {
        that.setData({
          todayEarnings: +(that.data.todayEarnings + that.data.secondSalary).toFixed(2)
        }, function() {
          that.drawWave();
          that.showPlusOne();
        });
      }, 1000);
      // 波浪動畫(每0.05秒重繪)
      const waveTimer = setInterval(function() {
        that.drawWave();
      }, 50);
      this.setData({ timer, waveTimer });
    },

    /**
     * 顯示 +1 動畫（每秒收入時觸發）
     * 會在圓圈上方產生一個 +1 或 +N，往上浮動並漸隱
     */
    showPlusOne() {
      // 根據每秒收入決定顯示內容
      const value = `+${this.data.secondSalary.toFixed(3)}`;
      // 每個動畫唯一 id
      const id = this.data.plusId + 1;
      // 初始動畫位置與透明度
      const plus = { id, top: 60, opacity: 1, value };
      this.setData({
        plusList: [...this.data.plusList, plus],
        plusId: id
      });
      const that = this;
      // 動畫：每20ms往上移動並漸隱
      const interval = setInterval(function() {
        const plusList = (that.data.plusList || []).map(item => {
          if (item.id === id) {
            // 讓 +1 往上移動並逐漸透明
            return { ...item, top: item.top - 2, opacity: item.opacity - 0.04 };
          }
          return item;
        });
        that.setData({ plusList });
        // 動畫結束後移除該 +1
        const current = plusList.find(item => item.id === id);
        if (!current || current.opacity <= 0) {
          clearInterval(interval);
          that.setData({ plusList: (that.data.plusList || []).filter(item => item.id !== id) });
        }
      }, 20);
    },
    onClockOut() {
      if (this.data.timer) clearInterval(this.data.timer);
      if (this.data.waveTimer) clearInterval(this.data.waveTimer);
      this.setData({ isClockedIn: false, timer: null, waveTimer: null }, () => {
        this.drawWave();
      });
    },
  },
})
