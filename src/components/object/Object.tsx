import {
	createContext,
	CSSProperties,
	HTMLAttributes,
	ReactNode,
	useContext,
	useRef,
} from 'react';
import { CanvasObject } from './useCreateObject.js';
import { useRerasterize } from '../../logic/rerasterizeSignal.js';
import { useMergedRef } from '../../hooks.js';
import { useGesture } from '@use-gesture/react';
import { useCanvas } from '../CanvasProvider.js';
import { CanvasGestureInfo } from '../../logic/Canvas.js';
import { ContainerPortal } from './ContainerPortal.js';
import { animated } from '@react-spring/web';
import { track } from 'signia-react';
import { CONTAINER_STATE } from './private.js';
import { ObjectDragImpostor } from './ObjectDragImpostor.js';

export interface ObjectProps extends HTMLAttributes<HTMLDivElement> {
	value: CanvasObject;
	onTap?: (info: CanvasGestureInfo) => void;
}

const baseStyle: CSSProperties = {
	position: 'absolute',
	touchAction: 'none',
};

export const Object = track(function Object({
	value,
	onTap,
	children,
	style: userStyle,
	...rest
}: ObjectProps) {
	const ref = useRef<HTMLDivElement>(null);
	useRerasterize(ref);
	const finalRef = useMergedRef(ref, value.ref);
	const canvas = useCanvas();
	const bind = useGesture({
		onDragEnd: (state) => {
			if (state.tap) {
				canvas.gestureState.claimedBy = value.id;
				const info: CanvasGestureInfo = {
					alt: state.altKey,
					ctrlOrMeta: state.ctrlKey || state.metaKey,
					shift: state.shiftKey,
					distance: canvas.viewport.viewportDeltaToWorld({
						x: state.offset[0],
						y: state.offset[1],
					}),
					delta: canvas.viewport.viewportDeltaToWorld({
						x: state.delta[0],
						y: state.delta[1],
					}),
					intentional: true,
					worldPosition: canvas.viewport.viewportToWorld({
						x: state.xy[0],
						y: state.xy[1],
					}),
					targetId: value.id,
				};
				onTap?.(info);
			}
		},
	});

	const style: CSSProperties = {
		...baseStyle,
		...userStyle,
		...value.style,
	};

	const containerState = value[CONTAINER_STATE].value;

	return (
		<ContainerPortal containerId={value.containerId}>
			<ObjectContext.Provider value={value}>
				<ObjectDragImpostor>
					{({ hidden }) => (
						<animated.div
							ref={finalRef}
							style={{
								...style,
								visibility: hidden ? 'hidden' : 'visible',
							}}
							{...bind()}
							{...rest}
							data-object-over={!!containerState.overId}
						>
							{children}
						</animated.div>
					)}
				</ObjectDragImpostor>
			</ObjectContext.Provider>
		</ContainerPortal>
	);
});

const ObjectContext = createContext<CanvasObject | null>(null);

export function useObject() {
	const val = useContext(ObjectContext);
	if (!val) {
		throw new Error('useObject must be used inside an Object');
	}
	return val;
}
