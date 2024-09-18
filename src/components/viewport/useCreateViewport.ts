import { useState } from 'react';
import { Viewport, ViewportConfig } from '../../logic/Viewport.js';

export function useCreateViewport(config?: ViewportConfig) {
	return useState(() => new Viewport(config))[0];
}
