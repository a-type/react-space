import {
	createContext,
	CSSProperties,
	HTMLAttributes,
	ReactNode,
	useContext,
	useEffect,
	useRef,
	useSyncExternalStore,
} from 'react';
import { Vector2 } from '../../types.js';
import { Viewport, ViewportEventOrigin } from '../../logic/Viewport.js';
import {
	useKeyboardControls,
	useViewportGestureControls,
} from './viewportHooks.js';
import { useMergedRef } from '../../hooks.js';
import { to, useSpring } from '@react-spring/web';
import { SPRINGS } from '../../constants.js';
import { rerasterizeSignal } from '../../logic/rerasterizeSignal.js';
import { animated } from '@react-spring/web';
import { preventDefault } from '@a-type/utils';

export function useViewport() {
	const viewport = useContext(ViewportContext);
	if (!viewport) {
		throw new Error('useViewport must be used within a ViewportRoot component');
	}
	return viewport;
}

export const ViewportContext = createContext<Viewport | null>(null);

export interface ViewportRootProps extends HTMLAttributes<HTMLDivElement> {
	viewport: Viewport;
}

const baseStyle: CSSProperties = {
	width: '100%',
	height: '100%',
	flex: 1,
	overflow: 'hidden',
	userSelect: 'none',
	cursor: 'move',
	position: 'relative',
	touchAction: 'none',
	contain: 'strict',
};

export const ViewportRoot = ({
	children,
	className,
	viewport,
	style: userStyle,
	...props
}: ViewportRootProps) => {
	const ref = useRef<HTMLDivElement>(null);

	const viewportProps = useViewportGestureControls(viewport, ref);

	const keyboardProps = useKeyboardControls(viewport);

	const finalRef = useMergedRef<HTMLDivElement>(
		ref,
		keyboardProps.ref,
		viewport.bindElement,
	);

	const style = userStyle ? { ...userStyle, ...baseStyle } : baseStyle;

	return (
		<ViewportContext.Provider value={viewport}>
			<div
				className={className}
				style={style}
				{...props}
				{...viewportProps}
				{...keyboardProps}
				ref={finalRef}
			>
				<ViewportSurface viewport={viewport}>{children}</ViewportSurface>
			</div>
		</ViewportContext.Provider>
	);
};

const VIEWPORT_ORIGIN_SPRINGS = {
	control: SPRINGS.QUICK,
	animation: SPRINGS.RELAXED,
	// not actually used, for direct we do immediate:true to disable
	// easing
	direct: SPRINGS.RESPONSIVE,
};

const viewportSurfaceStyle: CSSProperties = {
	position: 'absolute',
	overflow: 'visible',
	overscrollBehavior: 'none',
	touchAction: 'none',
	transformOrigin: 'center',
	userSelect: 'none',
};

function ViewportSurface({
	viewport,
	children,
}: {
	viewport: Viewport;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	// keep track of viewport element size as provided by Viewport class
	const viewportSize = useSyncExternalStore(
		(cb) => viewport.subscribe('sizeChanged', cb),
		() => viewport.elementSize,
	);

	// the main spring which controls the Canvas transformation.
	// X/Y position is in World Space - i.e. the coordinate space
	// is not affected by the zoom
	const [{ centerX, centerY }, panSpring] = useSpring(() => ({
		centerX: viewport.center.x,
		centerY: viewport.center.y,
		config: SPRINGS.RELAXED,
	}));
	const [{ zoom }, zoomSpring] = useSpring(() => ({
		zoom: viewport.zoomValue,
		isZooming: false,
		config: SPRINGS.RELAXED,
	}));

	const contentOffset = useSyncExternalStore(
		(cb) => viewport.subscribe('panLimitsChanged', cb),
		() => viewport.contentOffset,
	);

	useEffect(() => {
		async function handleCenterChanged(
			center: Readonly<Vector2>,
			origin: ViewportEventOrigin,
		) {
			panSpring.start({
				centerX: center.x,
				centerY: center.y,
				immediate: origin === 'direct',
				config: VIEWPORT_ORIGIN_SPRINGS[origin],
			});
		}
		async function handleZoomChanged(
			zoomValue: number,
			origin: ViewportEventOrigin,
		) {
			await zoomSpring.start({
				zoom: zoomValue,
				immediate: origin === 'direct',
				config: VIEWPORT_ORIGIN_SPRINGS[origin],
			})[0];
		}
		const unsubs = [
			viewport.subscribe('centerChanged', handleCenterChanged),
			viewport.subscribe('zoomChanged', handleZoomChanged),
			viewport.subscribe('zoomSettled', (zoom) => {
				// wait until after animation settles to update variable
				// and trigger rerasterize
				ref.current?.style.setProperty('--zoom-settled', zoom.toString());
				rerasterizeSignal.dispatchEvent(new Event('rerasterize'));
			}),
		];
		return () => {
			unsubs.forEach((unsub) => unsub());
		};
	}, [viewport, panSpring, zoomSpring]);

	return (
		<animated.div
			ref={ref}
			style={{
				...viewportSurfaceStyle,
				transform: to([centerX, centerY, zoom], (cx, cy, zoomv) => {
					// 1. Translate the center of the canvas to 0,0 (-halfCanvasWidth, -halfCanvasHeight)
					// 2. Translate that center point back to the center of the screen (+viewport.size.width / 2, +viewport.size.height / 2)
					// 3. Scale up (or down) to the specified zoom value
					// 4. Translate the center according to the pan position
					return `translate(${viewportSize.width / 2}px, ${
						viewportSize.height / 2
					}px) translate(-50%, -50%) scale(${zoomv}, ${zoomv}) translate(${contentOffset.x}px, ${contentOffset.y}px) translate(${-cx}px, ${-cy}px)`;
				}),
				// @ts-ignore
				'--zoom': zoom,
			}}
			onDragStart={preventDefault}
			onDrag={preventDefault}
			onDragEnd={preventDefault}
		>
			{children}
		</animated.div>
	);
}
