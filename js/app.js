/* * =================================
 * app.js - 膨胀机计算器核心逻辑 (ES6 模块化修复版)
 * 职责: 1. 导入 CoolProp 加载器。
 * 2. 初始化 UI 和事件。
 * 3. 核心热力学计算。
 * =================================
 */

// ---------------------------------
//  1. 导入 CoolProp 加载器
// ---------------------------------
// 假设您已在 js/ 目录中创建了 coolprop_loader.js 文件
import { loadCoolProp } from './coolprop_loader.js'; 

// ---------------------------------
//  2. 全局变量与工质定义
// ---------------------------------

let CP; // CoolProp 模块实例
const KELVIN_OFFSET = 273.15; // 摄氏度转开尔文

// 工质映射
const fluidMaps = {
    orc: {
        "R245fa": "R245fa",
        "R134a": "R134a",
        "R600a": "Isobutane", // R600a 在 CoolProp 中是 Isobutane
        "R1233zd(E)": "R1233ZDE",
        "R123": "R123"
    },
    steam: {
        "水/蒸汽": "Water"
    },
    gas: {
        "空气": "Air",
        "二氧化碳": "CarbonDioxide",
        "甲烷": "Methane",
        "氮气": "Nitrogen"
    }
};

// ---------------------------------
//  3. DOM 元素获取与初始化
// ---------------------------------

// DOMContentLoaded 事件由 <script type="module"> 自动处理，无需手动监听
let statusBar, fluidSelect, calculateButton, clearButton, tabLinks;
let massFlowInputs, volumeFlowInputs, flowModeRadios;

// 替换原来的 initializeApp 函数
function initializeApp() {
    // 获取 DOM 元素
    statusBar = document.getElementById("status-bar");
    fluidSelect = document.getElementById("fluid-select");
    calculateButton = document.getElementById("calculate-button");
    clearButton = document.getElementById("clear-button");
    tabLinks = document.querySelectorAll(".tab-link");
    massFlowInputs = document.getElementById("mass-flow-inputs");
    volumeFlowInputs = document.getElementById("volume-flow-inputs");
    flowModeRadios = document.querySelectorAll('input[name="flow-mode"]');

    // 绑定事件监听
    calculateButton.addEventListener("click", handleCalculation);
    clearButton.addEventListener("click", clearForm);

    tabLinks.forEach(link => {
        link.addEventListener("click", handleTabClick);
    });

    flowModeRadios.forEach(radio => {
        radio.addEventListener("change", handleFlowModeChange);
    });

    // 初始化
    initAppLogic(); // 调用新的加载逻辑
    updateFluidOptions('orc'); // 默认加载 ORC 工质
    handleFlowModeChange(); // 默认设置流量模式
}

// ---------------------------------
//  4. 应用启动逻辑 (取代旧的 loadCoolProp)
// ---------------------------------

async function initAppLogic() {
    try {
        // 调用从 coolprop_loader.js 导入的加载函数
        const CP_instance = await loadCoolProp(); 
        CP = CP_instance; // 存储 CP 实例
        
        // 成功状态
        let version = CP.get_global_param_string("version");
        console.log("CoolProp Version:", version);

        // 更新 UI 状态
        statusBar.textContent = "CoolProp 物性库加载成功 (v" + version + ")";
        statusBar.style.backgroundColor = "#e6f7ff";
        statusBar.style.color = "#006d75";
        statusBar.style.borderColor = "#b7eb8f";
        calculateButton.disabled = false; 
        calculateButton.textContent = "计算";

    } catch (err) {
        console.error("Failed to load CoolProp:", err);
        // (修复) 直接使用从 loader 抛出的详细错误信息，并保持换行
        statusBar.textContent = `错误：${err.message}`;
        statusBar.style.backgroundColor = "#fff1f0";
        statusBar.style.color = "#cf1322";
        statusBar.style.borderColor = "#ffa39e";
        statusBar.style.whiteSpace = "pre-wrap"; // 允许错误信息中的换行符生效
    }
}


// ---------------------------------
//  5. UI 交互处理 
// ---------------------------------

function handleTabClick(event) {
    tabLinks.forEach(link => link.classList.remove("active"));
    const clickedTab = event.target;
    clickedTab.classList.add("active");
    const tabName = clickedTab.dataset.tab; 
    updateFluidOptions(tabName);
}

function updateFluidOptions(tabName) {
    const fluids = fluidMaps[tabName];
    fluidSelect.innerHTML = ""; 
    for (const [displayName, coolPropName] of Object.entries(fluids)) {
        const option = document.createElement("option");
        option.value = coolPropName; 
        option.textContent = displayName; 
        fluidSelect.appendChild(option);
    }
}

function handleFlowModeChange() {
    const selectedMode = document.querySelector('input[name="flow-mode"]:checked').value;
    
    if (selectedMode === 'mass') {
        massFlowInputs.classList.remove('hidden');
        volumeFlowInputs.classList.add('hidden');
    } else {
        massFlowInputs.add('hidden');
        volumeFlowInputs.classList.remove('hidden');
    }
}

function clearForm() {
    document.getElementById("inlet-pressure").value = "20";
    document.getElementById("inlet-temperature").value = "150";
    document.getElementById("outlet-pressure").value = "4";
    document.getElementById("isentropic-efficiency").value = "85";
    document.getElementById("mass-flow").value = "1";
    document.getElementById("displacement").value = "500";
    document.getElementById("rpm").value = "3000";
    document.getElementById("volumetric-efficiency").value = "90";
    
    document.getElementById("result-power").value = "";
    document.getElementById("result-mass-flow").value = "";
    document.getElementById("result-volume-flow").value = "";

    const cells = document.querySelectorAll("#results-table-body td[id]");
    cells.forEach(cell => {
        cell.textContent = "--";
    });

    statusBar.textContent = "已清空。";
    statusBar.style.backgroundColor = "#f9f9f9";
    statusBar.style.color = "#555";
    statusBar.style.whiteSpace = "normal";
}

// ---------------------------------
//  6. 核心计算逻辑 
// ---------------------------------

function handleCalculation() {
    if (!CP) {
        statusBar.textContent = "错误：CoolProp 尚未加载完成。";
        return;
    }
    
    try {
        // --- 1. 获取所有输入并转换为 SI 单位 ---
        
        const fluidName = fluidSelect.value;

        const p1_bar = parseFloat(document.getElementById("inlet-pressure").value);
        const t1_c = parseFloat(document.getElementById("inlet-temperature").value);
        const p1_pa = p1_bar * 1e5;
        const t1_k = t1_c + KELVIN_OFFSET;

        const p2_bar = parseFloat(document.getElementById("outlet-pressure").value);
        const p2_pa = p2_bar * 1e5;

        const eta_s_percent = parseFloat(document.getElementById("isentropic-efficiency").value);
        const eta_s = eta_s_percent / 100.0;

        // --- 2. 验证输入 ---
        if (isNaN(p1_pa) || isNaN(t1_k) || isNaN(p2_pa) || isNaN(eta_s)) {
            throw new Error("输入无效：请检查所有参数是否为数字。");
        }
        if (p2_pa >= p1_pa) {
            throw new Error("输入无效：出口压力必须低于进口压力。");
        }
        if (eta_s <= 0 || eta_s > 1) {
             throw new Error("输入无效：等熵效率必须在 (0, 100] 范围内。");
        }

        // --- 3. 计算状态点 1 (进口) ---
        const h1 = CP.PropsSI('H', 'P', p1_pa, 'T', t1_k, fluidName); 
        const s1 = CP.PropsSI('S', 'P', p1_pa, 'T', t1_k, fluidName); 
        const d1 = CP.PropsSI('D', 'P', p1_pa, 'T', t1_k, fluidName); 
        const v1 = 1.0 / d1; 
        const x1 = CP.PropsSI('Q', 'P', p1_pa, 'T', t1_k, fluidName); 

        // --- 4. 计算状态点 2s (理想出口) ---
        const s2s = s1; 
        const h2s = CP.PropsSI('H', 'P', p2_pa, 'S', s2s, fluidName); 
        const t2s_k = CP.PropsSI('T', 'P', p2_pa, 'S', s2s, fluidName); 
        const d2s = CP.PropsSI('D', 'P', p2_pa, 'S', s2s, fluidName);
        const v2s = 1.0 / d2s;
        const x2s = CP.PropsSI('Q', 'P', p2_pa, 'S', s2s, fluidName);

        // --- 5. 计算状态点 2a (实际出口) ---
        const delta_h_s = h1 - h2s; 
        const delta_h_a = delta_h_s * eta_s; 
        const h2a = h1 - delta_h_a; 

        const t2a_k = CP.PropsSI('T', 'P', p2_pa, 'H', h2a, fluidName); 
        const s2a = CP.PropsSI('S', 'P', p2_pa, 'H', h2a, fluidName); 
        const d2a = CP.PropsSI('D', 'P', p2_pa, 'H', h2a, fluidName);
        const v2a = 1.0 / d2a;
        const x2a = CP.PropsSI('Q', 'P', p2_pa, 'H', h2a, fluidName);

        // --- 6. 计算流量和功率 ---
        let massFlow_kg_s, inletVolumeFlow_m3_s, power_W;
        
        const selectedMode = document.querySelector('input[name="flow-mode"]:checked').value;

        if (selectedMode === 'mass') {
            massFlow_kg_s = parseFloat(document.getElementById("mass-flow").value);
            if (isNaN(massFlow_kg_s)) throw new Error("质量流量输入无效。");
            inletVolumeFlow_m3_s = massFlow_kg_s * v1;
            
        } else { // 'volume'
            const Vg_cm3 = parseFloat(document.getElementById("displacement").value);
            const rpm = parseFloat(document.getElementById("rpm").value);
            const eta_v_percent = parseFloat(document.getElementById("volumetric-efficiency").value);
            
            if (isNaN(Vg_cm3) || isNaN(rpm) || isNaN(eta_v_percent)) {
                throw new Error("容积参数输入无效。");
            }

            const Vg_m3 = Vg_cm3 / 1e6;
            const eta_v = eta_v_percent / 100.0;
            
            const theoreticalVolumeFlow_m3_s = (Vg_m3 * rpm) / 60.0;
            inletVolumeFlow_m3_s = theoreticalVolumeFlow_m3_s * eta_v;
            massFlow_kg_s = inletVolumeFlow_m3_s / v1;
        }

        power_W = massFlow_kg_s * delta_h_a; 

        // --- 7. 格式化并显示结果 ---
        
        document.getElementById("result-power").value = (power_W / 1000.0).toFixed(2); 
        document.getElementById("result-mass-flow").value = massFlow_kg_s.toFixed(3); 
        document.getElementById("result-volume-flow").value = (inletVolumeFlow_m3_s * 3600).toFixed(2); 

        updateCell("val-p1", p1_bar.toFixed(2));
        updateCell("val-t1", t1_c.toFixed(2));
        updateCell("val-h1", (h1 / 1000.0).toFixed(2));
        updateCell("val-s1", (s1 / 1000.0).toFixed(4));
        updateCell("val-v1", v1.toFixed(5));
        updateCell("val-x1", formatQuality(x1));
        
        updateCell("val-p2s", p2_bar.toFixed(2));
        updateCell("val-t2s", (t2s_k - KELVIN_OFFSET).toFixed(2));
        updateCell("val-h2s", (h2s / 1000.0).toFixed(2));
        updateCell("val-s2s", (s2s / 1000.0).toFixed(4));
        updateCell("val-v2s", v2s.toFixed(5));
        updateCell("val-x2s", formatQuality(x2s));

        updateCell("val-p2a", p2_bar.toFixed(2));
        updateCell("val-t2a", (t2a_k - KELVIN_OFFSET).toFixed(2));
        updateCell("val-h2a", (h2a / 1000.0).toFixed(2));
        updateCell("val-s2a", (s2a / 1000.0).toFixed(4));
        updateCell("val-v2a", v2a.toFixed(5));
        updateCell("val-x2a", formatQuality(x2a));

        statusBar.textContent = "计算完成。";
        statusBar.style.backgroundColor = "#f6ffed";
        statusBar.style.color = "#389e0d";
        statusBar.style.whiteSpace = "normal";

    } catch (err) {
        console.error("Calculation Error:", err);
        statusBar.textContent = "计算错误: " + err.message;
        statusBar.style.backgroundColor = "#fff1f0";
        statusBar.style.color = "#cf1322";
        statusBar.style.whiteSpace = "normal";
    }
}

// ---------------------------------
//  7. 辅助工具函数 
// ---------------------------------

function updateCell(id, value) {
    document.getElementById(id).textContent = value;
}

function formatQuality(x) {
    if (x > 0 && x < 1) {
        return x.toFixed(4); 
    } else if (x <= 0 || x === -Infinity) {
        return "过冷"; 
    } else if (x >= 1 || x === Infinity) {
        return "过热"; 
    }
    return "--"; 
}

// 在 DOM 加载后，启动 App 逻辑
// 注意：这个在模块中是可选的，但为了安全性和明确性，我们保留它。
document.addEventListener("DOMContentLoaded", initializeApp);