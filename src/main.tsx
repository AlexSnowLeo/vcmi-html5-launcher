import { render } from "preact";
import "xp.css";
import "./index.css";


import { Provider, useSelector } from "react-redux";
import { State, store } from "./util/store";
import { Loader } from "./ui/resource-loader";
import { VCMIWindow } from "./ui/vcmi-window";
import { useT } from "./i18n";
import { DataSelect } from "./ui/data-select";
import { VCMIConfig } from "./ui/vcmi-config";

function Page() {
    const state = useSelector((state: State) => state.ui.step);

    switch (state) {
        case "DATA_SELECT": {
            return <DataSelect />;
        };
        case "LOADING_DATA": {
            return <Loader resourceType="datafile" />;
        };
        case "LOADING_WASM":
            return <Loader resourceType="wasm" />;
        case "READY_TO_RUN":
            return <VCMIConfig />;
    }

    return null;
}

function App() {
    const t = useT();
    const state = useSelector((state: State) => state.ui.step);

    if (state === "STARTED") {
        return <VCMIWindow />;
    }

    return <div class="flex flex-col w-full h-full items-center justify-center">
        <div class="window w-96 overflow-y-auto">
            <div class="title-bar">
                <div class="title-bar-text">{t("title")}</div>
                <div class="title-bar-controls">
                    <button aria-label="Minimize"></button>
                    <button aria-label="Maximize"></button>
                    <button aria-label="Close"></button>
                </div>
            </div>
            <div class="window-body">
                <Page />
            </div>
        </div>
    </div>;
}

(function() {
    render(
        <Provider store={store}>
            {<App /> as any}
        </Provider>,
        document.getElementById("app")!,
    );
})();