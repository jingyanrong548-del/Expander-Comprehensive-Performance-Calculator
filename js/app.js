/* * =================================
 * app.js - 膨胀机计算器核心逻辑 (最终修正版)
 * 职责: 1. 导入 CoolProp 加载器。
 *       2. 初始化 UI 和事件，处理多模式切换。
 *       3. (修正) 确保切换选项卡时，计算状态被正确同步，修复错误的物性调用问题。
 * =================================
 */

// ---------------------------------
//  1. 导入 CoolProp 加载器
// ---------------------------------
import { loadCoolProp } from './coolprop_loader.js'; 

// ---------------------------------
//  2. 全局变量与工质定义
// ---------------------------------
let CP; 
const KELVIN_OFFSET = 273.15;

const fluidMaps = {
    orc: { "R245fa": "R245fa", "R134a": "R134a", "R600a": "Isobutane", "R1233zd(E)": "R1233ZDE", "R123": "R123" },
    steam: { "水/蒸汽": "Water" },
    gas: { "空气": "Air", "二氧化碳": "CarbonDioxide", "甲烷": "Methane", "氮气": "Nitrogen" }
};
let currentTab = 'orc'; 

// ---------------------------------
//  3. DOM 元素获取
// ---------------------------------
let statusBar, fluidSelect, calculateButton, clearButton, tabLinks;
let inletModeSelector, inletModeRadios, inletModePT, inletModeTsup, evapTempLabel;
let outletModeSelector, outletModeRadios, outletModePressure, outletModeCondTemp;
let flowModeRadios, massFlowInputs, displacementFlowInputs, directVolumeFlowInputs;

function initializeApp() {
    // 通用元素
    statusBar = document.getElementById("status-bar");
    fluidSelect = document.getElementById("fluid-select");
    calculateButton = document.getElementById("calculate-button");
    clearButton = document.getElementById("clear-button");
    tabLinks = document.querySelectorAll(".tab-link");

    // 进口状态UI
    inletModeSelector = document.getElementById("inlet-mode-selector");
    inletModeRadios = document.querySelectorAll('input[name="inlet-mode"]');
    inletModePT = document.getElementById("inlet-mode-pt");
    inletModeTsup = document.getElementById("inlet-mode-tsup");
    evapTempLabel = document.getElementById("evap-temp-label");

    // 出口状态UI
    outletModeSelector = document.getElementById("outlet-mode-selector");
    outletModeRadios = document.querySelectorAll('input[name="outlet-mode"]');
    outletModePressure = document.getElementById("outlet-mode-pressure");
    outletModeCondTemp = document.getElementById("outlet-mode-cond-temp");

    // 流量计算UI
    flowModeRadios = document.querySelectorAll('input[name="flow-mode"]');
    massFlowInputs = document.getElementById("mass-flow-inputs");
    displacementFlowInputs = document.getElementById("displacement-flow-inputs");
    directVolumeFlowInputs = document.getElementById("direct-volume-flow-inputs");

    // 绑定事件
    calculateButton.addEventListener("click", handleCalculation);
    clearButton.addEventListener("click", clearForm);
    tabLinks.forEach(link => link.addEventListener("click", handleTabClick));
    inletModeRadios.forEach(radio => radio.addEventListener("change", handleInletModeChange));
    outletModeRadios.forEach(radio => radio.addEventListener("change", handleOutletModeChange));
    flowModeRadios.forEach(radio => radio.addEventListener("change", handleFlowModeChange));

    // 初始化
    initAppLogic();
    updateUIForTab(); 
    updateFluidOptions();
    handleInletModeChange();
    handleOutletModeChange();
    handleFlowModeChange();
}

// ---------------------------------
//  4. 应用启动逻辑
// ---------------------------------
async function initAppLogic() {
    try {
        const CP_instance = await loadCoolProp();
        CP = CP_instance;
        let version = CP.get_global_param_string("version");
        statusBar.textContent = "CoolProp 物性库加载成功 (v" + version + ")";
        statusBar.style.backgroundColor = "#e6f7ff";
        statusBar.style.color = "#006d75";
        calculateButton.disabled = false;
        calculateButton.textContent = "计算";
    } catch (err) {
        statusBar.textContent = `错误：${err.message}`;
        statusBar.style.backgroundColor = "#fff1f0";
        statusBar.style.color = "#cf1322";
        statusBar.style.whiteSpace = "pre-wrap";
    }
}

// ---------------------------------
//  5. UI 交互处理 
// ---------------------------------
function handleTabClick(event) {
    tabLinks.forEach(link => link.classList.remove("active"));
    const clickedTab = event.target;
    clickedTab.classList.add("active");
    currentTab = clickedTab.dataset.tab;
    updateFluidOptions(); // 关键：先更新选项
    updateUIForTab();     // 再更新UI
}

function updateFluidOptions() {
    const fluids = fluidMaps[currentTab];
    fluidSelect.innerHTML = "";
    for (const [displayName, coolPropName] of Object.entries(fluids)) {
        const option = new Option(displayName, coolPropName);
        fluidSelect.add(option);
    }
    // 【关键修复】: 动态添加选项后，手动将选择索引重置为第一个。
    // 这可以确保 fluidSelect.value 总是与新列表的第一个选项同步。
    if (fluidSelect.options.length > 0) {
        fluidSelect.selectedIndex = 0;
    }
}

function updateUIForTab() {
    const isGas = currentTab === 'gas';
    inletModeSelector.classList.toggle('hidden', isGas);
    outletModeSelector.classList.toggle('hidden', isGas);
    
    if (isGas) {
        document.getElementById('mode-pt').checked = true;
        document.getElementById('outlet-mode-p').checked = true;
    } else {
        evapTempLabel.textContent = (currentTab === 'orc') ? "蒸发温度" : "饱和温度";
    }
    handleInletModeChange();
    handleOutletModeChange();
}

function handleInletModeChange() {
    const selectedMode = document.querySelector('input[name="inlet-mode"]:checked').value;
    inletModePT.classList.toggle('hidden', selectedMode !== 'pt');
    inletModeTsup.classList.toggle('hidden', selectedMode !== 'tsup');
}

function handleOutletModeChange() {
    const selectedMode = document.querySelector('input[name="outlet-mode"]:checked').value;
    outletModePressure.classList.toggle('hidden', selectedMode !== 'pressure');
    outletModeCondTemp.classList.toggle('hidden', selectedMode !== 'tcond');
}

function handleFlowModeChange() {
    const selectedMode = document.querySelector('input[name="flow-mode"]:checked').value;
    massFlowInputs.classList.add('hidden');
    displacementFlowInputs.classList.add('hidden');
    directVolumeFlowInputs.classList.add('hidden');
    if (selectedMode === 'mass') massFlowInputs.classList.remove('hidden');
    else if (selectedMode === 'displacement') displacementFlowInputs.classList.remove('hidden');
    else if (selectedMode === 'volume') directVolumeFlowInputs.classList.remove('hidden');
}

function clearForm() {
    document.getElementById("inlet-pressure").value = "20";
    document.getElementById("inlet-temperature").value = "150";
    document.getElementById("evap-temp").value = "120";
    document.getElementById("superheat").value = "10";
    document.getElementById("outlet-pressure").value = "4";
    document.getElementById("condensing-temperature").value = "30";
    document.getElementById("isentropic-efficiency").value = "85";
    document.getElementById("mass-flow").value = "1";
    document.getElementById("displacement").value = "500";
    document.getElementById("rpm").value = "3000";
    document.getElementById("volumetric-efficiency").value = "90";
    document.getElementById("volume-flow-rate").value = "100";
    
    document.getElementById("result-power").value = "";
    document.getElementById("result-mass-flow").value = "";
    document.getElementById("result-volume-flow").value = "";

    const cells = document.querySelectorAll("#results-table-body td[id]");
    cells.forEach(cell => { cell.textContent = "--"; });

    document.getElementById("mode-pt").checked = true;
    document.getElementById("outlet-mode-p").checked = true;
    document.getElementById("mode-mass").checked = true;

    updateUIForTab();
    handleFlowModeChange();

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
        const fluidName = fluidSelect.value;
        let p1_pa, t1_k, p2_pa;

        // 【防御性代码】确保所选流体属于当前标签页
        const validFluids = Object.values(fluidMaps[currentTab]);
        if (!validFluids.includes(fluidName)) {
            throw new Error(`内部状态错误：当前工质 '${fluidName}' 与选项卡 '${currentTab}' 不匹配。`);
        }

        // --- 确定进口状态 ---
        const inletMode = document.querySelector('input[name="inlet-mode"]:checked').value;
        if (currentTab === 'gas' || inletMode === 'pt') {
            p1_pa = parseFloat(document.getElementById("inlet-pressure").value) * 1e5;
            t1_k = parseFloat(document.getElementById("inlet-temperature").value) + KELVIN_OFFSET;
            if (isNaN(p1_pa) || isNaN(t1_k)) throw new Error("压力/温度输入无效。");
        } else { // 'tsup'
            const evap_temp_k = parseFloat(document.getElementById("evap-temp").value) + KELVIN_OFFSET;
            const superheat_k = parseFloat(document.getElementById("superheat").value);
            if (isNaN(evap_temp_k) || isNaN(superheat_k)) throw new Error("饱和温度/过热度输入无效。");
            p1_pa = CP.PropsSI('P', 'T', evap_temp_k, 'Q', 1, fluidName);
            t1_k = evap_temp_k + superheat_k;
        }

        // --- 确定出口压力 ---
        const outletMode = document.querySelector('input[name="outlet-mode"]:checked').value;
        if (currentTab === 'gas' || outletMode === 'pressure') {
            p2_pa = parseFloat(document.getElementById("outlet-pressure").value) * 1e5;
            if (isNaN(p2_pa)) throw new Error("出口压力输入无效。");
        } else { // 'tcond'
            const t_cond_k = parseFloat(document.getElementById("condensing-temperature").value) + KELVIN_OFFSET;
            if (isNaN(t_cond_k)) throw new Error("冷凝温度输入无效。");
            p2_pa = CP.PropsSI('P', 'T', t_cond_k, 'Q', 0, fluidName);
        }

        const eta_s = parseFloat(document.getElementById("isentropic-efficiency").value) / 100.0;
        if (isNaN(eta_s) || eta_s <= 0 || eta_s > 1) throw new Error("等熵效率必须在 (0, 100] 范围内。");
        if (p2_pa >= p1_pa) throw new Error("计算出的出口压力 (" + (p2_pa/1e5).toFixed(2) + " bar) 必须低于进口压力 (" + (p1_pa/1e5).toFixed(2) + " bar)。");

        // --- 状态点计算 ---
        const h1 = CP.PropsSI('H', 'P', p1_pa, 'T', t1_k, fluidName); 
        const s1 = CP.PropsSI('S', 'P', p1_pa, 'T', t1_k, fluidName); 
        const v1 = 1.0 / CP.PropsSI('D', 'P', p1_pa, 'T', t1_k, fluidName); 
        const phase1 = CP.PropsSI('Phase', 'P', p1_pa, 'T', t1_k, fluidName);
        const x1 = (phase1 === 3) ? CP.PropsSI('Q', 'P', p1_pa, 'T', t1_k, fluidName) : -1;

        const s2s = s1;
        const h2s = CP.PropsSI('H', 'P', p2_pa, 'S', s2s, fluidName); 
        const t2s_k = CP.PropsSI('T', 'P', p2_pa, 'S', s2s, fluidName);
        const v2s = 1.0 / CP.PropsSI('D', 'P', p2_pa, 'S', s2s, fluidName);
        const phase2s = CP.PropsSI('Phase', 'P', p2_pa, 'S', s2s, fluidName);
        const x2s = (phase2s === 3) ? CP.PropsSI('Q', 'P', p2_pa, 'S', s2s, fluidName) : -1;
        
        const h2a = h1 - (h1 - h2s) * eta_s; 
        const t2a_k = CP.PropsSI('T', 'P', p2_pa, 'H', h2a, fluidName); 
        const s2a = CP.PropsSI('S', 'P', p2_pa, 'H', h2a, fluidName);
        const v2a = 1.0 / CP.PropsSI('D', 'P', p2_pa, 'H', h2a, fluidName);
        const phase2a = CP.PropsSI('Phase', 'P', p2_pa, 'H', h2a, fluidName);
        const x2a = (phase2a === 3) ? CP.PropsSI('Q', 'P', p2_pa, 'H', h2a, fluidName) : -1;

        // --- 流量和功率计算 ---
        let massFlow_kg_s;
        const flowMode = document.querySelector('input[name="flow-mode"]:checked').value;
        switch (flowMode) {
            case 'mass':
                massFlow_kg_s = parseFloat(document.getElementById("mass-flow").value);
                if (isNaN(massFlow_kg_s) || massFlow_kg_s <= 0) throw new Error("质量流量必须是正数。");
                break;
            case 'displacement':
                const Vg_cm3 = parseFloat(document.getElementById("displacement").value);
                const rpm = parseFloat(document.getElementById("rpm").value);
                const eta_v = parseFloat(document.getElementById("volumetric-efficiency").value) / 100.0;
                if (isNaN(Vg_cm3) || isNaN(rpm) || isNaN(eta_v)) throw new Error("几何排量参数输入无效。");
                if (Vg_cm3 <= 0 || rpm <= 0 || eta_v <= 0) throw new Error("几何排量、转速和容积效率必须是正数。");
                massFlow_kg_s = ((Vg_cm3 / 1e6 * rpm) / 60.0 * eta_v) / v1;
                break;
            case 'volume':
                const volume_flow_m3h = parseFloat(document.getElementById("volume-flow-rate").value);
                if (isNaN(volume_flow_m3h) || volume_flow_m3h <= 0) throw new Error("体积流量必须是正数。");
                massFlow_kg_s = (volume_flow_m3h / 3600.0) / v1;
                break;
        }

        const power_W = massFlow_kg_s * (h1 - h2a);
        const final_inlet_volume_flow_m3h = massFlow_kg_s * v1 * 3600;

        // --- 显示结果 ---
        document.getElementById("result-power").value = (power_W / 1000.0).toFixed(2); 
        document.getElementById("result-mass-flow").value = massFlow_kg_s.toFixed(3); 
        document.getElementById("result-volume-flow").value = final_inlet_volume_flow_m3h.toFixed(2); 
        
        const p2_bar_final = p2_pa / 1e5;
        updateCell("val-p1", (p1_pa / 1e5).toFixed(2));
        updateCell("val-t1", (t1_k - KELVIN_OFFSET).toFixed(2));
        updateCell("val-h1", (h1 / 1000.0).toFixed(2));
        updateCell("val-s1", (s1 / 1000.0).toFixed(4));
        updateCell("val-v1", v1.toFixed(5));
        updateCell("val-x1", formatPhase(phase1, x1));
        
        updateCell("val-p2s", p2_bar_final.toFixed(2));
        updateCell("val-t2s", (t2s_k - KELVIN_OFFSET).toFixed(2));
        updateCell("val-h2s", (h2s / 1000.0).toFixed(2));
        updateCell("val-s2s", (s2s / 1000.0).toFixed(4)); 
        updateCell("val-v2s", v2s.toFixed(5));
        updateCell("val-x2s", formatPhase(phase2s, x2s));

        updateCell("val-p2a", p2_bar_final.toFixed(2));
        updateCell("val-t2a", (t2a_k - KELVIN_OFFSET).toFixed(2));
        updateCell("val-h2a", (h2a / 1000.0).toFixed(2));
        updateCell("val-s2a", (s2a / 1000.0).toFixed(4));
        updateCell("val-v2a", v2a.toFixed(5));
        updateCell("val-x2a", formatPhase(phase2a, x2a));

        statusBar.textContent = "计算完成。";
        statusBar.style.backgroundColor = "#f6ffed";
        statusBar.style.color = "#389e0d";

    } catch (err) {
        console.error("Calculation Error:", err);
        statusBar.textContent = "计算错误: " + err.message;
        statusBar.style.backgroundColor = "#fff1f0";
        statusBar.style.color = "#cf1322";
    }
}

// ---------------------------------
//  7. 辅助工具函数 
// ---------------------------------
function updateCell(id, value) {
    document.getElementById(id).textContent = value;
}

function formatPhase(phaseIndex, qualityValue) {
    if (currentTab === 'gas') return "N/A";
    switch (phaseIndex) {
        case 0: return "过冷";
        case 5: return "过热";
        case 3: 
            if (qualityValue > -1e-9 && qualityValue < 1e-9) return "饱和液";
            if (qualityValue > 1 - 1e-9 && qualityValue < 1 + 1e-9) return "饱和汽";
            return qualityValue.toFixed(4);
        case 1: return "超临界";
        case 2: return "超临界气体";
        case 4: return "超临界液体";
        default: return "--";
    }
}

document.addEventListener("DOMContentLoaded", initializeApp);