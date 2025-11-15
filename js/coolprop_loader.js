// =====================================================================
// coolprop_loader.js: CoolProp 物性库加载器 (已修复)
// 职责: 1. 异步加载 CoolProp WASM 模块
//        2. (修复) 使用 Emscripten 提供的 'prefix' 参数来正确定位 .wasm 文件，使其更具鲁棒性。
//        3. (修复) 提供更详细、更具指导性的错误信息。
// =====================================================================

// 导入 CoolProp JS 包装器
import Module from './coolprop.js'; 

/**
 * 异步加载 CoolProp WASM 模块.
 * @returns {Promise<object>} 返回 CoolProp (CP) 实例.
 */
export async function loadCoolProp() {
    try {
        const moduleArgs = {
            // locateFile 函数告诉 Emscripten 在哪里寻找 .wasm 文件
            locateFile: (path, prefix) => {
                // Emscripten 默认会传递 .wasm 文件的基本名称 (如 'coolprop.wasm')
                // 和它自己的脚本所在的目录 (prefix, 如 'js/')。
                // 我们将它们组合起来，就能得到最可靠的文件路径。
                if (path.endsWith('.wasm')) {
                    const wasmPath = prefix + path;
                    console.log(`尝试从此路径加载 CoolProp WASM: ${wasmPath}`);
                    return wasmPath + `?v=${Date.now()}`; // 添加时间戳防止缓存
                }
                // 对于其他可能的文件，也使用默认逻辑
                return prefix + path;
            }
        };

        // 将配置对象传递给 Module 工厂函数进行初始化
        const CP = await Module(moduleArgs);
        
        console.log("CoolProp 模块初始化成功。");
        return CP;

    } catch (err) {
        console.error("CoolProp WASM 加载失败:", err);
        // 抛出更具体的错误，由 app.js 捕获并显示给用户
        let errorMessage = "CoolProp 加载失败。";
        if (err.message.includes("Aborted")) {
             errorMessage += "这通常意味着 'coolprop.wasm' 文件未找到 (404 Not Found) 或因协议限制无法加载。";
             errorMessage += "\n请确认 'coolprop.wasm' 文件与 'coolprop.js' 文件都在 'js' 目录下。";
             if (window.location.protocol === 'file:') {
                errorMessage += "\n\n关键提示：您当前正通过 'file://' 协议访问页面，这无法加载物性库。请务必通过 Web 服务器 (例如 VS Code 的 'Live Server' 插件) 来访问此页面。";
             }
        } else {
            errorMessage += `具体错误: ${err.message}`;
        }
        throw new Error(errorMessage);
    }
}