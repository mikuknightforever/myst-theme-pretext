import React, { useEffect, useId, useRef, useState } from 'react';
import { useNearScreen } from '@myst-theme/providers';
import type { IOutput } from '@jupyterlab/nbformat';
import { useFetchAnyTruncatedContent } from './hooks.js';
import type { MinifiedOutput } from 'nbtx';
import { convertToIOutputs } from 'nbtx';
import { fetchAndEncodeOutputImages } from './convertImages.js';
import { SourceFileKind } from 'myst-spec-ext';
import { useThebeLoader } from 'thebe-react';
import { PassiveOutputRenderer } from './passive.js';
import { outputWithUniqueIds } from './unique-ids.js';

/**
 * Render one output whose MIME bundle can't be displayed with plain HTML
 * (e.g. text/html from pandas, plotly JSON, Jupyter widgets).
 * Outputs that CAN render directly go through `SafeOutput` instead (see `output.tsx`).
 *
 * Uses thebe-core's rendermime registry via `PassiveOutputRenderer`.
 * "thebe" here does NOT mean a live kernel, we're only using its MIME→DOM renderers.
 *
 * @param outputsId - The id of the cell.
 * @param output - The output data.
 */
const LoadedJupyterOutput = React.memo(
  ({ outputsId, output }: { outputsId: string; output: MinifiedOutput }) => {
    const { core, load } = useThebeLoader();
    const { data, error } = useFetchAnyTruncatedContent([output]);
    const [fullOutput, setFullOutput] = useState<IOutput | null>(null);
    // Each rendered copy of an output gets its own ids (see unique-ids.ts).
    const copyId = useId().replace(/[^A-Za-z0-9]/g, '');

    useEffect(() => {
      if (core) return;
      load();
    }, [core, load]);

    useEffect(() => {
      if (!data || fullOutput != null) return;

      fetchAndEncodeOutputImages(data).then((out) => {
        const compactOutputs = convertToIOutputs(out, {});
        setFullOutput(outputWithUniqueIds(compactOutputs[0], copyId));
      });
    }, [outputsId, data, fullOutput, copyId]);

    if (error) {
      console.error(error);
      return <div className="text-red-500">Error rendering output: {error.message}</div>;
    }

    // if (!inCrossRef && exec?.ready) {
    //   return (
    //     <div>
    //       {!fullOutputs && <div className="p-2.5">Fetching full output data...</div>}
    //       {core && fullOutputs && (
    //         <ActiveOutputRenderer key={id} id={id} initialData={fullOutputs} core={core} />
    //       )}
    //     </div>
    //   );
    // }

    return (
      <div>
        {!fullOutput && <div className="p-2.5">Loading...</div>}
        {fullOutput && core && (
          <PassiveOutputRenderer
            id={outputsId}
            data={fullOutput}
            core={core}
            kind={SourceFileKind.Notebook}
          ></PassiveOutputRenderer>
        )}
      </div>
    );
  },
);

/** Space kept for an output that has not loaded yet, so the page does not
 * jump much when it does. Most charts are about this tall. */
const PLACEHOLDER_MIN_HEIGHT = 300;

/**
 * Fetching and rendering an output waits until it is near the screen: an
 * output can be megabytes of HTML with its own copy of a plotting library.
 * Where lazy loading is off (see LazyLoadingProvider), it loads at once.
 */
export const JupyterOutput = React.memo(
  ({ outputsId, output }: { outputsId: string; output: MinifiedOutput }) => {
    const ref = useRef<HTMLDivElement>(null);
    const near = useNearScreen(ref);
    if (near) return <LoadedJupyterOutput outputsId={outputsId} output={output} />;
    return (
      <div ref={ref} style={{ minHeight: PLACEHOLDER_MIN_HEIGHT }}>
        <div className="p-2.5">Loading...</div>
      </div>
    );
  },
);
