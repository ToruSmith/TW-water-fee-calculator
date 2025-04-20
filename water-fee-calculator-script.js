	      // 原有的數據定義
	      const baseFeeTable = {
	        "13": 34, "20": 68, "25": 126, "40": 374, "50": 680,
	        "75": 1836, "100": 3638, "150": 10098, "200": 20060,
	        "250": 35428, "300": 55590
	      };
	      const normalRatesMonthly = [
	        { range: [1, 10], price: 7 },
	        { range: [11, 30], price: 9 },
	        { range: [31, 50], price: 11 },
	        { range: [51, Infinity], price: 11.5 }
	      ];
	      const normalRatesBimonthly = [
	        { range: [1, 20], price: 7 },
	        { range: [21, 60], price: 9 },
	        { range: [61, 100], price: 11 },
	        { range: [101, Infinity], price: 11.5 },
	      ];
	      const userTypes = {
	        normal: { label: "一般用水", baseFeeDiscount: 1, waterFeeDiscount: 1 },
	        military: { label: "軍眷用水", baseFeeDiscount: 0.5, waterFeeDiscount: "first40half" },
	        municipal: { label: "市政用水", baseFeeDiscount: 0.5, waterFeeDiscount: 0.5 },
	        Temporary: { label: "臨時用水(農業、空地)", baseFeeDiscount: 1.5, waterFeeDiscount: 1.5 },
	        illegal: { label: "違章用水", baseFeeDiscount: 1.2, waterFeeDiscount: 1.2 },
	        discounted: { label: "優惠用水(國小、國中)", baseFeeDiscount: 1, waterFeeFlatRate: 7 }
	      };

	      // 全局變數，用於存儲計算結果以供圖表使用
	      let calculationResults = null;
	      let pieChart = null, barChart = null, lineChart = null;

	      function formatMoney(amount) {
	        return amount.toLocaleString("zh-TW", { style: "currency", currency: "TWD", minimumFractionDigits: 0 });
	      }

	      function calculateWaterFee() {
	        const resultDiv = document.getElementById("result");
	        resultDiv.innerHTML = "";
	        const loader = document.getElementById("loader");
	        loader.style.display = "block";
	        
	        // 模擬計算延遲，增加用戶體驗
	        setTimeout(() => {
	            const meterSize = document.getElementById("meterSize").value;
	            const realUsage = parseFloat(document.getElementById("waterUsage").value) || 0;
	            const sharedUsage = parseFloat(document.getElementById("sharedUsage").value) || 0;
	            const totalUsage = realUsage + sharedUsage;

	            const WDR = parseFloat(document.getElementById("WasteDisposalRate").value);
                    const SSR = parseFloat(document.getElementById("SewageSewerRate").value);
	            const wrccfRate = parseFloat(document.getElementById("wrccfRate").value);
	            const userTypeKey = document.getElementById("userType").value;
	            const userType = userTypes[userTypeKey];
	            const billingCycle = document.getElementById("billingCycle").value;
	            const isMonthly = billingCycle === "monthly";

	            if (isNaN(realUsage) || realUsage < 0 || isNaN(sharedUsage) || sharedUsage < 0) {
	              resultDiv.innerHTML = "<p>請輸入有效的實際用水度數和分攤度數！<\/p>";
	              loader.style.display = "none";
	              hideCharts();
	              return;
	            }

	            let baseFee = baseFeeTable[meterSize] * userType.baseFeeDiscount;
	            if (isMonthly) baseFee *= 0.5;
	            const baseTax = baseFee * 0.05;
	            const baseFeeWithTax = baseFee + baseTax;

	            let rawRates = isMonthly ? normalRatesMonthly : normalRatesBimonthly;
	            let waterRates;

	            if (userType.waterFeeFlatRate !== undefined) {
	              waterRates = [{ range: [1, Infinity], price: userType.waterFeeFlatRate, military: false }];
	            } else if (userType.waterFeeDiscount === "first40half") {
	              waterRates = getMilitaryRates(rawRates, isMonthly);
	            } else {
	              waterRates = rawRates.map(r => ({
	                ...r,
	                price: r.price * userType.waterFeeDiscount,
	                military: false
	              }));
	            }

	            let waterFee = 0;
	            let breakdown = [];
	            let remaining = totalUsage;
	            for (const { range, price, military } of waterRates) {
	              const [min, max] = range;
	              if (totalUsage >= min) {
	                const usageInTier = Math.min(remaining, (max === Infinity ? remaining : (max - min + 1)));
	                breakdown.push({
	                  range: `${min}-${max === Infinity ? "以上" : max}度`,
	                  usage: usageInTier,
	                  rate: price,
	                  fee: usageInTier * price,
	                  military
	                });
	                waterFee += usageInTier * price;
	                remaining -= usageInTier;
	                if (remaining <= 0) break;
	              }
	            }

	            const waterTax = waterFee * 0.05;
	            const waterFeeWithTax = waterFee + waterTax;

	            const unDiscountedWaterFee = calculateUnDiscountedFee(totalUsage, rawRates);
	            const WRCCF = unDiscountedWaterFee * wrccfRate;
	            const WDT = realUsage * WDR;
		    const SST = totalUsage * SSR;
	            const LevyFee = Math.round(WDT) + Math.round(WRCCF) + Math.round(SST);
	            const total = baseFeeWithTax + waterFeeWithTax + LevyFee;

	            // 儲存計算結果用於圖表
	            calculationResults = {
	                baseFee,
	                baseTax,
	                waterFee,
	                waterTax,
	                WDT: Math.round(WDT),
                        SST: Math.round(SST),
	                WRCCF: Math.round(WRCCF),
	                total,
	                breakdown,
	                userType: userType.label,
	                totalUsage,
	                realUsage,
	                sharedUsage,
	                waterRates,
	                rawRates
	            };

	            resultDiv.innerHTML = `
	              <h3>計算結果（${userType.label}）<\/h3>
	              <div class="breakdown-item info-box">
	                <strong>度數說明：<\/strong><br>
	                實際用水度數：${realUsage} 度<br>
	                分攤度數：${sharedUsage} 度<br>
	                <strong> 總用水度數（計算水費用）：${totalUsage} 度 <\/strong>
	              <\/div>
	              <br>
	              <div class="breakdown-item highlight-box">
	                <strong>基本費：<\/strong> ${formatMoney(baseFee)}${userType.baseFeeDiscount < 1 ? "（優惠）" : ""}
	                <br>營業稅（基本費）：${formatMoney(baseTax)}
	              <\/div>

	              <h4>用水費明細：<\/h4>
	              ${breakdown.map(item => `
	                <div class="breakdown-item">
	                  ${item.range}：${item.usage}度 × ${(item.rate).toFixed(2)}元 = ${formatMoney(item.fee)}
	                  ${item.military ? "（軍眷半價）" : ""}
	                <\/div>`).join("")}

	              <div class="breakdown-item highlight-box">
	                用水費小計：${formatMoney(waterFee)}
	                <br>營業稅（用水費）：${formatMoney(waterTax)}
	              <\/div>

	              <h4>代徵費用：<\/h4>
	              <div class="breakdown-item highlight-box">
	                清除處理費（不含分攤度數）：${realUsage}度 × ${WDR}元 = ${Math.round(WDT)} 元
	                <br>水源保育與回饋費：${formatMoney(unDiscountedWaterFee)} × ${(wrccfRate * 100).toFixed(0)}% = ${Math.round(WRCCF)} 元
                        <br>污水下水道使用費（總用水度數）：${totalUsage}度 × ${SSR}元 = ${Math.round(SST)} 元
	              <\/div>

	              <div class="total-highlight">總計金額：${formatMoney(total)}<\/div>
	            `;
	            
	            // 顯示結果區域和圖表
	            resultDiv.classList.add("show");
	            updateCharts();
	            loader.style.display = "none";
	            
	            // 添加水滴動畫
	            createWaterDrops();
	        }, 500);
	      }

	      // 計算未優惠的水費（用於水源保育與回饋費）
	      function calculateUnDiscountedFee(totalUsage, rates) {
	        let fee = 0;
	        let remaining = totalUsage;
	        
	        for (const { range, price } of rates) {
	          const [min, max] = range;
	          if (totalUsage >= min) {
	            const usageInThisTier = Math.min(remaining, (max === Infinity ? remaining : max - min + 1));
	            fee += usageInThisTier * price;
	            remaining -= usageInThisTier;
	            if (remaining <= 0) break;
	          }
	        }
	        
	        return fee;
	      }

	      function getMilitaryRates(rates, isMonthly) {
	        const halfPriceLimit = isMonthly ? 20 : 40;
	        let accumulatedUsage = 0;
	        const result = [];
	        
	        for (const { range, price } of rates) {
	          const [min, max] = range;
	          
	          // 處理範圍內的半價部分
	          if (accumulatedUsage < halfPriceLimit) {
	            const startRange = min;
	            const remainingHalfPrice = halfPriceLimit - accumulatedUsage;
	            const rangeSize = max === Infinity ? Infinity : max - min + 1;
	            const halfPriceUsage = Math.min(remainingHalfPrice, rangeSize);
	            
	            // 添加半價區間
	            if (halfPriceUsage > 0) {
	              result.push({
	                range: [startRange, startRange + halfPriceUsage - 1],
	                price: price / 2,
	                military: true
	              });
	              accumulatedUsage += halfPriceUsage;
	            }
	            
	            // 添加剩餘的正常價格區間
	            if (max !== Infinity && startRange + halfPriceUsage - 1 < max) {
	              result.push({
	                range: [startRange + halfPriceUsage, max],
	                price: price,
	                military: false
	              });
	            }
	          } else {
	            // 完全正常價格的區間
	            result.push({
	              range: [min, max],
	              price: price,
	              military: false
	            });
	          }
	        }
	        return result;
	      }

	      // 切換主題
	      document.getElementById("themeToggle").addEventListener("click", function() {
	        document.body.classList.toggle("dark-theme");
	        // 如果已經繪製了圖表，更新圖表顏色
	        if (calculationResults) {
	          updateCharts();
	        }
	      });

	      // 標籤頁切換功能
	      document.querySelectorAll('.tab').forEach(tab => {
	        tab.addEventListener('click', function() {
	          // 移除所有標籤和內容的活動狀態
	          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
	          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
	          
	          // 設置當前標籤和內容為活動狀態
	          this.classList.add('active');
	          const tabId = this.getAttribute('data-tab');
	          document.getElementById(tabId).classList.add('active');
	        });
	      });

	      // 創建水滴動畫
	      function createWaterDrops() {
	        const count = 15; // 水滴數量
	        
	        for (let i = 0; i < count; i++) {
	          setTimeout(() => {
	            const drop = document.createElement('div');
	            drop.className = 'water-drop';
	            
	            // 隨機位置
	            const posX = Math.random() * window.innerWidth;
	            drop.style.left = posX + 'px';
	            drop.style.top = '0px';
	            
	            // 隨機大小
	            const size = Math.random() * 8 + 15;
	            drop.style.width = size + 'px';
	            drop.style.height = size + 'px';
	            
	            // 隨機透明度
	            drop.style.opacity = Math.random() * 0.5 + 0.2;
	            
	            document.body.appendChild(drop);
	            
	            // 動畫結束後移除元素
	            setTimeout(() => {
	              drop.remove();
	            }, 1500);
	          }, i * 100); // 間隔出現
	        }
	      }

	// 隱藏所有圖表
	function hideCharts() {
	 document.querySelectorAll('.chart-container').forEach(container => {
	   container.classList.remove('show');
	 });
	}  // 這裡添加了缺少的右花括號

	// 更新所有圖表
	function updateCharts() {
	 if (!calculationResults) return;
	 
	 // 顯示所有圖表容器
	 document.querySelectorAll('.chart-container').forEach(container => {
	   container.classList.add('show');
	 });
	 
	 // 獲取深淺色主題
	 const isDarkMode = document.body.classList.contains('dark-theme');
	 const textColor = isDarkMode ? '#eee' : '#333';
	 
	 // 更新圓餅圖 - 費用分佈
	 updatePieChart(textColor);
	 
	 // 更新長條圖 - 費用明細
	 updateBarChart(textColor);
	 
	 // 更新折線圖 - 階梯價格結構
	 updateLineChart(textColor);
	}

	// 更新圓餅圖
	function updatePieChart(textColor) {
	 const ctx = document.getElementById('feeDistributionChart').getContext('2d');
	 
	 // 如果已有圖表，先銷毀
	 if (pieChart) {
	   pieChart.destroy();
	 }
	 
	 const data = {
	   labels: [
	     '基本費',
	     '用水費',
	     '營業稅',
	     '清除處理費',
             '污水下水道使用費',
	     '水源保育與回饋費'
	   ],
	   datasets: [{
	     data: [
	       calculationResults.baseFee,
	       calculationResults.waterFee,
	       calculationResults.baseTax + calculationResults.waterTax,
	       calculationResults.WDT,
               calculationResults.SST,
	       calculationResults.WRCCF
	     ],
	     backgroundColor: [
	       'rgba(255, 99, 132, 0.7)',
	       'rgba(54, 162, 235, 0.7)',
	       'rgba(255, 206, 86, 0.7)',
	       'rgba(75, 192, 192, 0.7)',
	       'rgba(153, 102, 255, 0.7)',
               'rgba(100, 220, 150, 0.7)' 
	     ],
	     borderColor: [
	       'rgba(255, 99, 132, 1)',
	       'rgba(54, 162, 235, 1)',
	       'rgba(255, 206, 86, 1)',
	       'rgba(75, 192, 192, 1)',
	       'rgba(153, 102, 255, 1)',
               'rgba(100, 220, 150, 1)' 
	     ],
	     borderWidth: 1
	   }]
	 };
	 
	 pieChart = new Chart(ctx, {
	   type: 'pie',
	   data: data,
	   options: {
	     responsive: true,
	     plugins: {
	       legend: {
	         position: 'top',
	         labels: {
	           color: textColor
	         }
	       },
	       title: {
	         display: true,
	         text: '水費組成分佈',
	         color: textColor,
	         font: {
	           size: 20
	         }
	       },
	       tooltip: {
	         callbacks: {
	           label: function(context) {
	             const label = context.label || '';
	             const value = context.raw || 0;
	             const percentage = Math.round((value / calculationResults.total) * 100);
	             return `${label}: ${value.toLocaleString('zh-TW')}元 (${percentage}%)`;
	           }
	         }
	       }
	     }
	   }
	 });
	}

	// 更新長條圖
	function updateBarChart(textColor) {
	 const ctx = document.getElementById('feeBreakdownChart').getContext('2d');
	 
	 // 如果已有圖表，先銷毀
	 if (barChart) {
	   barChart.destroy();
	 }
	 
	 // 從計算結果中提取階梯用水費明細
	 const labels = calculationResults.breakdown.map(item => item.range);
	 const data = calculationResults.breakdown.map(item => item.fee);
	 
	 barChart = new Chart(ctx, {
	   type: 'bar',
	   data: {
	     labels: labels,
	     datasets: [{
	       label: '各級距用水費',
	       data: data,
	       backgroundColor: 'rgba(54, 162, 235, 0.7)',
	       borderColor: 'rgba(54, 162, 235, 1)',
	       borderWidth: 1
	     }]
	   },
	   options: {
	     responsive: true,
	     scales: {
	       y: {
	         beginAtZero: true,
	         ticks: {
	           color: textColor
	         },
	         title: {
	           display: true,
	           text: '用水費(元)',
	           color: textColor ,
	         },

	         grid: {
	           color: textColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
	         }
	       },
	       x: {
	         ticks: {
	           color: textColor
	         },
	         grid: {
	           color: textColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
	         }
	       }
	     },
	     plugins: {
	       legend: {
	         labels: {
	           color: textColor
	         }
	       },
	       title: {
	         display: true,
	         text: '級距水費明細',
	         color: textColor,
	         font: {
	           size: 20
	         }
	       }
	     }
	   }
	 });
	}

	// 更新折線圖
	function updateLineChart(textColor) {
	 const ctx = document.getElementById('priceStructureChart').getContext('2d');
	 
	 // 如果已有圖表，先銷毀
	 if (lineChart) {
	   lineChart.destroy();
	 }
	 
	 // 從計算結果中提取價格結構
	 const rateInfo = [];
	 for (const rate of calculationResults.waterRates) {
	   rateInfo.push({
	     x: rate.range[0],
	     y: rate.price,
	     label: rate.military ? '軍眷優惠' : '基本費率'
	   });
	   
	   // 如果不是無限範圍，添加範圍結束點
	   if (rate.range[1] !== Infinity) {
	     rateInfo.push({
	       x: rate.range[1],
	       y: rate.price,
	       label: rate.military ? '軍眷優惠' : '基本費率'
	     });
	   }
	 }
	 
	 // 按 x 值排序
	 rateInfo.sort((a, b) => a.x - b.x);
	 
	 // 分離數據點
	 const normalRatePoints = rateInfo.filter(point => point.label === '基本費率');
	 const militaryRatePoints = rateInfo.filter(point => point.label === '軍眷優惠');
	 
	 const datasets = [];
	 
	 // 添加基本費率數據集
	 if (normalRatePoints.length > 0) {
	   datasets.push({
	     label: '基本費率',
	     data: normalRatePoints.map(point => ({ x: point.x, y: point.y })),
	     borderColor: 'rgba(54, 162, 235, 1)',
	     backgroundColor: 'rgba(54, 162, 235, 0.1)',
	     fill: false,
	     stepped: true
	   });
	 }
	 
	 // 添加軍眷優惠數據集
	 if (militaryRatePoints.length > 0) {
	   datasets.push({
	     label: '軍眷優惠',
	     data: militaryRatePoints.map(point => ({ x: point.x, y: point.y })),
	     borderColor: 'rgba(255, 99, 132, 1)',
	     backgroundColor: 'rgba(255, 99, 132, 0.1)',
	     fill: false,
	     stepped: true
	   });
	 }
	 
	 // 添加實際用水量標記
	 datasets.push({
	   label: '實際用水量',
	   data: [{ x: calculationResults.totalUsage, y: 0 }, { x: calculationResults.totalUsage, y: 15 }],
	   borderColor: 'rgba(75, 192, 192, 1)',
	   backgroundColor: 'rgba(75, 192, 192, 0.5)',
	   borderWidth: 4,
	   borderDash: [5, 5],
	   pointRadius: 0
	 });
	 
	 lineChart = new Chart(ctx, {
	   type: 'line',
	   data: {
	     datasets: datasets
	   },
	   options: {
	     responsive: true,
	     scales: {
	       x: {
	         type: 'linear',
	         position: 'bottom',
	         title: {
	           display: true,
	           text: '用水度數',
	           color: textColor
	         },
	         ticks: {
	           color: textColor
	         },
	         grid: {
	           color: textColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
	         }
	       },
	       y: {
	         beginAtZero: true,
	         title: {
	           display: true,
	           text: '每度價格(元)',
	           color: textColor
	         },
	         ticks: {
	           color: textColor
	         },
	         grid: {
	           color: textColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
	         }
	       }
	     },
	     plugins: {
	       legend: {
	         labels: {
	           color: textColor
	         }
	       },
	       title: {
	         display: true,
	         text: '用水階梯價格結構',
	         color: textColor,
	         font: {
	           size: 20
	         }
	       },
	       tooltip: {
	         callbacks: {
	           title: function(context) {
	             return `用水度數: ${context[0].parsed.x}`;
	           },
	           label: function(context) {
	             return `每度價格: ${context.parsed.y.toLocaleString('zh-TW')}元`;
	           }
	         }
	       }
	     }
	   }
	 });
	}