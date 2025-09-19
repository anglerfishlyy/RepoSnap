#!/usr/bin/env node
import { snapRepo } from '../core/reposnap-core.js';

const snapshot = await snapRepo();
console.log(snapshot);
