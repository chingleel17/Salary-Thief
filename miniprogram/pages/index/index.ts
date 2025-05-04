import { formatTime } from '../../utils/util'; // 確保引入 formatTime

// index.ts
// 获取应用实例
// const app = getApp<IAppOption>() // 暫時註解掉未使用的 app
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
    todayEarnings: 0, // 今日所得 - 改為 number
    isClockedIn: false, // 是否已打卡
    clockInTime: 0, // 打卡時間戳記
    timer: null as any, // 跳錢計時器
    waveTimer: null as any, // 波浪動畫計時器
    dateTimeTimer: null as any, // 日期時間計時器
    plusList: [] as Array<{ id: number, top: number, opacity: number, value: string }>, // +1動畫列表
    plusId: 0, // 遞增id
    canvasContext: null as any, // Canvas 上下文
    canvasWidth: 0,
    canvasHeight: 0,
    isDataLoaded: false, // 數據是否已從存儲加載
    currentDate: '', // 目前日期
    currentTime: '', // 目前時間
    // hasUserInfo: false, // 這個似乎在您的原始碼中有，但未在 data 中定義，暫時移除，如果需要請加回
  },

  // --- 生命周期函数 ---
  lifetimes: {
    attached() {
      console.log('Component attached');
      this.loadDataFromStorage(); // 載入數據
      this.updateDateTime(); // 立即更新一次日期時間
      this.startDateTimeTimer(); // 啟動日期時間計時器
      // 確保 Canvas 初始化（如果需要的話）
      // 注意：如果 step 不是 2，Canvas 可能還不存在於 WXML 中
      if (this.data.step === 2) {
        // 延遲一點確保 WXML 渲染完成
        setTimeout(() => this.initCanvas(), 100);
      }
    },
    detached() {
      console.log('Component detached');
      // 清除所有計時器
      if (this.data.timer) clearInterval(this.data.timer);
      if (this.data.waveTimer) clearInterval(this.data.waveTimer);
      if (this.data.dateTimeTimer) clearInterval(this.data.dateTimeTimer);
      console.log('Timers cleared on detach');
      // 可選：在頁面卸載時也保存一次數據
      this.saveDataToStorage();
    }
  },

  methods: {
    // --- 資料持久化 ---
    saveDataToStorage() {
      if (!this.data.isDataLoaded) {
        console.log('Data not loaded yet, skipping save.');
        return; // 如果初始數據還沒加載完，不保存
      }
      try {
        const dataToSave = {
          step: this.data.step,
          userInfo: this.data.userInfo,
          salary: this.data.salary,
          workingDays: this.data.workingDays,
          dailySalary: this.data.dailySalary,
          secondSalary: this.data.secondSalary,
          isClockedIn: this.data.isClockedIn,
          todayEarnings: this.data.todayEarnings, // 保存數字類型
          clockInTime: this.data.clockInTime,
        };
        wx.setStorageSync('salaryThiefData', dataToSave);
        console.log('Data saved:', dataToSave);
      } catch (e) {
        console.error('Failed to save data to storage:', e);
      }
    },

    loadDataFromStorage() {
      try {
        const savedData = wx.getStorageSync('salaryThiefData');
        if (savedData) {
          console.log('Data loaded:', savedData);
          this.setData({
            step: savedData.step ?? 0,
            userInfo: savedData.userInfo ?? { avatarUrl: defaultAvatarUrl, nickName: '' },
            salary: savedData.salary ?? '',
            workingDays: savedData.workingDays ?? '',
            dailySalary: savedData.dailySalary ?? 0,
            secondSalary: savedData.secondSalary ?? 0,
            isClockedIn: savedData.isClockedIn ?? false,
            todayEarnings: savedData.todayEarnings ?? 0, // 載入數字
            clockInTime: savedData.clockInTime ?? 0,
            isDataLoaded: true, // 標記數據已加載
          }, () => {
            // 數據設置完成後的回調
            console.log('Data applied, current step:', this.data.step, 'isClockedIn:', this.data.isClockedIn);
            if (this.data.step === 2) {
              // 如果直接進入主畫面，嘗試初始化 Canvas
              // 延遲確保 WXML 渲染
              setTimeout(() => {
                this.initCanvas(); // 先初始化 Canvas
                if (this.data.isClockedIn) {
                  // 如果是已打卡狀態，恢復計時器並計算經過時間的收益
                  console.log('Resuming clock-in state...');
                  this.resumeClockInState(); // 計算收益並啟動計時器
                } else {
                  // 如果未打卡，也需要繪製一次初始狀態的波浪
                  console.log('Drawing initial wave for non-clocked-in state.');
                  this.drawWave(); // 使用載入的收益繪製
                }
              }, 100);
            }
          });
        } else {
          this.setData({ isDataLoaded: true }); // 即使沒有數據也要標記加載完成
          console.log('No saved data found.');
        }
      } catch (e) {
        this.setData({ isDataLoaded: true }); // 出錯也要標記
        console.error('Failed to load data from storage:', e);
      }
    },

    // --- 輸入與步驟處理 ---
    onChooseAvatar(e: any) {
      const { avatarUrl } = e.detail
      this.setData({
        "userInfo.avatarUrl": avatarUrl,
      }, () => {
        this.saveDataToStorage(); // 保存頭像變更
      });
    },

    onInputChange(e: any) {
      const { type } = e.target.dataset;
      const value = e.detail.value;
      let needsSave = false;
      let nextStep = this.data.step;

      if (type === 'nickname') {
        this.setData({ "userInfo.nickName": value });
        if (value && value.trim()) {
          nextStep = 1; // 準備進入下一步
          needsSave = true;
        }
      } else if (type === 'salary') {
        this.setData({ salary: value });
        needsSave = true;
      } else if (type === 'workingDays') {
        this.setData({ workingDays: value });
        needsSave = true;
      }

      // 檢查是否可以計算薪資並進入主畫面
      const salary = Number(this.data.salary);
      const workingDays = Number(this.data.workingDays);

      if (this.data.step === 1 && salary > 0 && workingDays > 0) {
        const dailySalary = salary / workingDays; // 保留小數點以提高精度
        const secondSalary = dailySalary / (8 * 60 * 60); // 假設一天工作8小時
        this.setData({
          dailySalary,
          secondSalary,
          step: 2 // 直接進入主畫面
        }, () => {
          console.log('Calculated salaries, moving to step 2');
          this.saveDataToStorage(); // 保存計算結果和步驟
          // 延遲初始化 Canvas
          setTimeout(() => this.initCanvas(), 100);
        });
      } else if (needsSave) {
        // 如果只是輸入了部分或修改了暱稱
        if (nextStep !== this.data.step) {
          this.setData({ step: nextStep }, () => {
            this.saveDataToStorage(); // 保存步驟變更
          });
        } else {
          this.saveDataToStorage(); // 保存輸入值
        }
      }
    },

    // --- 打卡邏輯 ---
    onClockIn() {
      if (!this.data.dailySalary) {
        wx.showToast({ title: '請先輸入月薪與工作日', icon: 'none' });
        return;
      }
      const now = Date.now();
      this.setData({
        isClockedIn: true,
        clockInTime: now,
        todayEarnings: 0, // 每次上班重置今日收益
        plusList: [], // 清空動畫列表
      }, () => {
        console.log('Clocked in at:', now);
        this.startTimers(); // 啟動計時器
        this.saveDataToStorage(); // 保存狀態
      });
    },

    onClockOut() {
      console.log('Clocking out...');
      if (this.data.timer) clearInterval(this.data.timer);
      if (this.data.waveTimer) clearInterval(this.data.waveTimer);
      this.setData({
        isClockedIn: false,
        timer: null,
        waveTimer: null,
        // clockInTime: 0, // 保留上次打卡時間戳記可能有用，不清零
        // todayEarnings: 0, // 保留最後的收益金額
      }, () => {
        this.drawWave(); // 更新波浪到最終狀態
        this.saveDataToStorage(); // 保存狀態
        console.log('Clocked out.');
      });
    },

    // 恢復打卡狀態（從存儲加載後）
    resumeClockInState() {
      const now = Date.now();
      const loadedClockInTime = this.data.clockInTime; // 使用獨立變數增加可讀性
      const loadedSecondSalary = this.data.secondSalary;

      console.log(`Resuming: now=${now}, clockInTime=${loadedClockInTime}, secondSalary=${loadedSecondSalary}`);

      if (loadedClockInTime > 0 && loadedSecondSalary > 0) {
        const elapsedSeconds = (now - loadedClockInTime) / 1000;
        if (elapsedSeconds > 0) {
          const currentEarnings = elapsedSeconds * loadedSecondSalary;
          console.log(`Calculated resumed earnings: ${currentEarnings.toFixed(2)}`);
          this.setData({
            todayEarnings: currentEarnings // 設定計算好的收益
          }, () => {
            console.log(`Set resumed earnings: ${this.data.todayEarnings.toFixed(2)}`);
            // 在收益設定完成後再繪製波浪和啟動計時器
            this.drawWave();
            this.startTimers();
          });
        } else {
          // 打卡時間戳記無效（例如來自未來？）
          console.warn('Elapsed time is not positive. Resetting earnings.');
          this.setData({ todayEarnings: 0 }, () => {
            this.drawWave();
            this.startTimers(); // 仍然嘗試啟動計時器，但從 0 開始
          });
        }
      } else {
        // 從存儲載入的 clockInTime 或 secondSalary 無效
        console.warn('Invalid clockInTime or secondSalary on resume. Resetting earnings.');
        this.setData({ todayEarnings: 0 }, () => {
          this.drawWave();
          // 如果秒薪無效，不應該啟動計時器
          if (loadedSecondSalary > 0) {
            this.startTimers();
          } else {
            console.log("Not starting timers due to zero secondSalary.");
            // 可選：如果狀態不一致，強制下班
            // if (this.data.isClockedIn) { this.onClockOut(); }
          }
        });
      }
    },

    // --- 計時器管理 ---
    startTimers() {
      // 清除可能存在的舊計時器
      if (this.data.timer) clearInterval(this.data.timer);
      if (this.data.waveTimer) clearInterval(this.data.waveTimer);

      console.log(`Starting timers with clockInTime: ${this.data.clockInTime}, secondSalary: ${this.data.secondSalary}`);

      // 檢查啟動條件
      if (!this.data.isClockedIn || this.data.clockInTime <= 0 || this.data.secondSalary <= 0) {
        console.warn("Conditions not met to start earning timers.");
        // 確保即使計時器不啟動，波浪也能正確繪製
        this.drawWave();
        return;
      }

      // const that = this; // 不再需要，箭頭函數會綁定 this

      // 主計時器：更新收益和觸發動畫
      const timer = setInterval(() => {
        // 從 clockInTime 計算總收益，避免累加誤差
        const elapsedSeconds = (Date.now() - this.data.clockInTime) / 1000;
        const currentEarnings = elapsedSeconds * this.data.secondSalary;

        // 只有當收益實際增加時才觸發 setData 和動畫，減少不必要的更新
        // 使用一個小的閾值來比較浮點數
        if (currentEarnings > this.data.todayEarnings + 1e-9) { // 1e-9 是一個小數，避免浮點誤差          
          this.setData({
            todayEarnings: currentEarnings
          }, () => {
            // 在 setData 回調中觸發動畫，確保數據已更新
            this.showPlusOne();
          });
        }
      }, 1000); // 每秒檢查一次收益

      // 波浪動畫計時器 (獨立控制，更流暢)
      const waveTimer = setInterval(() => {
        this.drawWave();
      }, 50); // 控制波浪動畫幀率

      this.setData({ timer, waveTimer });
      console.log('Timers started:', { timer, waveTimer });
    },

    startDateTimeTimer() {
      if (this.data.dateTimeTimer) clearInterval(this.data.dateTimeTimer);
      const dateTimeTimer = setInterval(() => {
        this.updateDateTime();
      }, 1000 * 60); // 每分鐘更新一次
      this.setData({ dateTimeTimer });
      console.log('Date/Time timer started.');
    },

    // --- Canvas 繪圖 ---
    initCanvas() {
      console.log('Initializing canvas...');
      const query = wx.createSelectorQuery().in(this);
      query.select('#waveCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            console.error("Failed to get canvas node.");
            // 嘗試重新初始化
            // setTimeout(() => this.initCanvas(), 500);
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;

          // 使用組件的實際寬高，而不是固定值
          const width = res[0].width;
          const height = res[0].height;

          if (!width || !height) {
            console.error("Canvas width or height is zero.");
            // 可能是 WXML 還未完全渲染，稍後重試
            // setTimeout(() => this.initCanvas(), 500);
            return;
          }

          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);

          this.setData({
            canvasContext: ctx,
            canvasWidth: width,
            canvasHeight: height,
          }, () => {
            console.log('Canvas initialized with size:', width, height);
            this.drawWave(); // 初始化後繪製一次
          });
        });
    },

    // 繪製水位波浪 (使用 data 中的 canvas 屬性)
    drawWave() {
      const ctx = this.data.canvasContext;
      if (!ctx || !this.data.canvasWidth || !this.data.canvasHeight) {
        // console.log('Canvas context or dimensions not ready for drawing.');
        return; // 如果 canvas 未就緒則不繪製
      }

      const width = this.data.canvasWidth;
      const height = this.data.canvasHeight;

      ctx.clearRect(0, 0, width, height);

      // 畫圓形遮罩
      ctx.save();
      ctx.beginPath();
      // 稍微縮小一點半徑，避免裁剪掉邊框（如果有的話）
      const radius = Math.min(width, height) / 2 - 2;
      ctx.arc(width / 2, height / 2, radius, 0, 2 * Math.PI);
      ctx.clip(); // 應用裁剪

      // 水位百分比計算
      const earnings = this.data.todayEarnings || 0; // 確保 earnings 是數字且至少為 0
      const daily = this.data.dailySalary;
      // 確保 dailySalary 不是 0，給一個最小值防止除零錯誤
      const percent = daily > 0 ? Math.min(earnings / daily, 1) : 0;
      // console.log(`Drawing wave with earnings: ${earnings.toFixed(2)}, percent: ${percent.toFixed(2)}`); // 添加日誌

      // 波浪參數
      const amplitude = 8; // 波浪振幅 (原為 waveHeight)
      const frequency = 2 * Math.PI / (width / 1.2); // 波浪頻率 (原為 waveLength 相關)
      const speed = Date.now() / 400; // 波浪移動速度 (原為 now)

      // 繪製波浪路徑
      ctx.beginPath();
      const startY = height * (1 - percent); // 水位線 Y 座標
      ctx.moveTo(0, startY); // 起始點

      for (let x = 0; x <= width; x++) {
        const theta = x * frequency + speed;
        const y = startY + Math.sin(theta) * amplitude;
        ctx.lineTo(x, y);
      }

      // 封閉路徑
      ctx.lineTo(width, height); // 右下角
      ctx.lineTo(0, height); // 左下角
      ctx.closePath();

      // 填充顏色和透明度
      ctx.fillStyle = '#60a5fa'; // 藍色
      ctx.globalAlpha = 0.7; // 主波浪透明度
      ctx.fill();

      // 可選：繪製第二層波浪增加層次感
      ctx.beginPath();
      const startY2 = startY + 2; // 稍微低一點
      ctx.moveTo(0, startY2);
      for (let x = 0; x <= width; x++) {
        const theta = x * (frequency * 0.9) + speed + 1; // 不同的頻率和相位
        const y = startY2 + Math.sin(theta) * (amplitude * 0.8); // 較小的振幅
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = '#3b82f6'; // 深一點的藍色
      ctx.globalAlpha = 0.4; // 更透明
      ctx.fill();


      // 恢復繪圖環境（移除裁剪）
      ctx.restore();
      ctx.globalAlpha = 1; // 恢復透明度
    },

    // --- +N 動畫 ---
    showPlusOne() {
      if (!this.data.isClockedIn || this.data.secondSalary <= 0) return; // 未打卡或沒收入則不顯示

      // 根據每秒收入決定顯示內容
      let valueToShow = '';
      if (this.data.secondSalary >= 0.01) {
        // 如果每秒至少賺 0.01 元，顯示兩位小數
        valueToShow = `+${this.data.secondSalary.toFixed(2)}`;
      } else if (this.data.secondSalary > 0) {
        // 如果小於 0.01 但大於 0，可以顯示更多位數或固定值
        valueToShow = `+${this.data.secondSalary.toFixed(3)}`; // 或 '+0.001'
      } else {
        return; // 秒薪為0或負數，不顯示
      }

      const id = this.data.plusId + 1;
      const newPlus = { id: id, top: 60, opacity: 1, value: valueToShow }; // 初始位置和透明度
      const plusList = this.data.plusList;
      plusList.push(newPlus);
      this.setData({ plusList, plusId: id });

      // 動畫效果：向上移動並淡出
      let currentTop = 60;
      let currentOpacity = 1;
      const animationInterval = setInterval(() => {
        currentTop -= 2; // 向上移動速度
        currentOpacity -= 0.04; // 淡出速度

        const index = this.data.plusList.findIndex(item => item.id === id);
        if (index !== -1 && currentOpacity > 0) {
          this.setData({
            [`plusList[${index}].top`]: currentTop,
            [`plusList[${index}].opacity`]: currentOpacity,
          });
        } else {
          clearInterval(animationInterval);
          // 從列表中移除已經消失的元素
          // 異步移除，避免影響 setData
          setTimeout(() => {
            const currentList = this.data.plusList.filter(item => item.id !== id);
            this.setData({ plusList: currentList });
          }, 0);
        }
      }, 20); // 動畫幀率 (原為 20ms)
    },

    // --- 日期時間更新 ---
    updateDateTime() {
      const now = new Date();
      const formatted = formatTime(now); // "YYYY/MM/DD HH:mm:ss"
      this.setData({
        currentDate: formatted.split(' ')[0], // YYYY/MM/DD
        currentTime: formatted.split(' ')[1].substring(0, 5), // HH:mm
      });
    },

    // --- 其他輔助方法 ---
    // (如果需要 getUserProfile 等方法，請保留)
    getUserProfile() {
      // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
      wx.getUserProfile({
        desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
        success: (res) => {
          console.log(res)
          this.setData({
            userInfo: res.userInfo,
            // hasUserInfo: true // 如果需要這個狀態，請在 data 中定義
          }, () => {
            this.saveDataToStorage(); // 保存獲取的用戶信息
          });
        }
      })
    },
    // 重設數據
    resetData() {
      wx.showModal({
        title: '確認重設',
        content: '確定要清除所有設定和今日記錄嗎？',
        success: (res) => {
          if (res.confirm) {
            console.log('User confirmed reset.');
            // 停止計時器
            if (this.data.timer) clearInterval(this.data.timer);
            if (this.data.waveTimer) clearInterval(this.data.waveTimer);
            // 清除本地儲存
            wx.removeStorageSync('salaryThiefData');
            // 重設 data 到初始狀態
            this.setData({
              step: 0, // 回到暱稱輸入
              userInfo: { avatarUrl: defaultAvatarUrl, nickName: '' },
              salary: '',
              workingDays: '',
              dailySalary: 0,
              secondSalary: 0,
              todayEarnings: 0,
              isClockedIn: false,
              clockInTime: 0,
              timer: null,
              waveTimer: null,
              plusList: [],
              plusId: 0,
              // isDataLoaded: false, // 不需要重設這個
            }, () => {
              console.log('Data reset complete.');
              // 可選：重設後繪製一次空的 Canvas
              // if (this.data.canvasContext) {
              //   this.data.canvasContext.clearRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
              // }
            });
          } else if (res.cancel) {
            console.log('User cancelled reset.');
          }
        }
      });
    },

    bindViewTap() {
      wx.navigateTo({
        url: '../logs/logs',
      })
    },
  },
})
