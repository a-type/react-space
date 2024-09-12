import { EventSubscriber } from '@a-type/utils';
import { Box } from '../types.js';
import { CanvasGestureInfo } from './Canvas.js';

export interface ContainmentEvent<Metadata> {
	objectId: string;
	objectMetadata?: Metadata;
	objectBounds: Box;
	ownBounds: Box;
	gestureInfo: CanvasGestureInfo;
}

export interface ContainerConfig {
	id: string;
	accept: (containmentEvent: ContainmentEvent<any>) => boolean;
	priority?: number;
}

type ContainerEvents = {
	overObjectIdChanged: (overObjectId: string | null) => void;
};

export class Container extends EventSubscriber<ContainerEvents> {
	overObjectId: string | null = null;

	constructor(private config: ContainerConfig) {
		super();
	}

	accepts = (containmentEvent: ContainmentEvent<any>) => {
		return this.config.accept(containmentEvent);
	};

	get id() {
		return this.config.id;
	}

	get priority() {
		return this.config.priority ?? 0;
	}

	setCandidateState(overObjectId: string | null) {
		if (this.overObjectId !== overObjectId) {
			this.overObjectId = overObjectId;
			this.emit('overObjectIdChanged', overObjectId);
		}
	}
}
