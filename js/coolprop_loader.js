// =====================================================================
// coolprop_loader.js: CoolProp 物性库加载器 (已修复部署路径问题)
// 职责: 1. 异步加载 CoolProp WASM 模块
//        2. (修复) 动态计算 .wasm 文件的绝对路径，以适应 GitHub Pages 等子目录部署环境。
//        3. 提供更详细、更具指导性的错误信息。
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
            locateFile: (path, scriptDirectory) => {
                // 'path' 参数通常是 'coolprop.wasm'
                // 'scriptDirectory' 是 Emscripten 推测的脚本目录，但在子目录部署时可能不准确

                if (path.endsWith('.wasm')) {
                    // --- 动态路径修复逻辑 ---
                    
                    // 1. 获取当前页面的完整路径名 (例如 "/MyRepo/index.html" 或 "/")
                    let basePath = window.location.pathname;
                    
                    // 2. 如果路径以特定文件名结尾 (如 .html), 则截取到最后一个 '/'，以获得目录路径
                    //    这确保了无论访问的是根目录还是具体文件，我们都能得到正确的基准目录。
                    if (basePath.endsWith('.html')) {
                        basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
                    }
                    
                    // 3. 拼接成最终的绝对路径（相对于网站根域名）
                    //    例如，在 https://user.github.io/MyRepo/ 页面上:
                    //    basePath 将是 "/MyRepo/"
                    //    最终路径将是 "/MyRepo/js/coolprop.wasm"
                    const wasmPath = basePath + 'js/' + path;
                    
                    console.log(`[路径解析] 尝试从此路径加载 CoolProp WASM: ${wasmPath}`);
                    
                    // 4. (可选但推荐) 添加一个时间戳作为查询参数，以防止浏览器缓存旧的、错误的路径
                    return wasmPath + `?v=${Date.now()}`; 
                }
                
                // 对于其他可能的文件 (例如 .mem)，也使用默认逻辑
                return scriptDirectory + path;
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
        if (err.message.includes("Aborted") || (err.name && err.name.includes("NotFoundError"))) {
             errorMessage += "这通常意味着 'coolprop.wasm' 文件未找到 (404 Not Found) 或因协议限制无法加载。";
             errorMessage += "\n请确认 'coolprop.wasm' 文件与 'coolprop.js' 文件都在 'js' 目录下，并且已成功推送到服务器。";
             if (window.location.protocol === 'file:') {
                errorMessage += "\n\n关键提示：您当前正通过 'file://' 协议访问页面，这无法加载物性库。请务必通过 Web 服务器 (例如 VS Code 的 'Live Server' 插件) 来访问此页面。";
             }
        } else {
            errorMessage += `具体错误: ${err.message}`;
        }
        throw new Error(errorMessage);
    }
}