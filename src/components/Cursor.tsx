import { useSpring, animated } from '@react-spring/web';
import { CSSProperties, ReactNode, useEffect } from 'react';

export interface CursorProps {
	children: ReactNode;
	className?: string;
	subscribeToActivity: (
		callback: (position: { x: number; y: number }, active?: boolean) => void,
	) => void;
	color?: string;
	pointer?: ReactNode;
}

const baseStyle: CSSProperties = {
	position: 'absolute',
	touchAction: 'none',
	pointerEvents: 'none',
	transformOrigin: 'top left',
	display: 'flex',
	flexDirection: 'row',
	alignItems: 'start',
};

export function Cursor({
	children,
	className,
	subscribeToActivity,
	color,
	pointer,
}: CursorProps) {
	const [style, spring] = useSpring(() => ({
		x: 0,
		y: 0,
		opacity: 0,
	}));

	useEffect(() => {
		return subscribeToActivity(({ x, y }, active) => {
			spring.start({
				x,
				y,
				opacity: active ? 1 : 0,
			});
		});
	}, [spring, subscribeToActivity]);

	return (
		<animated.div
			className={className}
			style={{
				...baseStyle,
				x: style.x,
				y: style.y,
				opacity: style.opacity,
				scale: 'calc(1/(var(--zoom,1)))',
				// @ts-ignore
				'--color': color ?? 'gray',
			}}
		>
			{pointer || <CursorGraphic />}
			{children}
		</animated.div>
	);
}

const baseGraphicStyle: CSSProperties = {
	borderWidth: '6px',
	borderStyle: 'solid',
	borderTopColor: 'var(--color)',
	borderLeftColor: 'var(--color)',
	borderRightColor: 'transparent',
	borderBottomColor: 'transparent',
};

function CursorGraphic() {
	return <div style={baseGraphicStyle} />;
}
